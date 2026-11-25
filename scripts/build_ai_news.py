"""Build one edition from Quant Log's public live archives and public news feeds."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import json
from pathlib import Path
import re
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET


CHANNEL = "https://www.youtube.com/@QuantLogTatsuya/streams"
VIDEO_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCvpdFdz4iCD-degYzeuuDBQ"
JST = timezone(timedelta(hours=9))
PUBLIC_SITE = "https://tatsuya862.github.io/japanese-quant-log/ai-news/"


@dataclass(frozen=True)
class Source:
    name: str
    url: str
    host: str
    major: str = ""
    ai_feed: bool = False
    primary: bool = False
    group: str = ""


SOURCES = (
    Source("OpenAI", "https://openai.com/news/rss.xml", "openai.com", "OpenAI", True, True),
    Source("Google", "https://blog.google/technology/ai/rss/", "blog.google", "Google", True, True),
    Source("Microsoft", "https://blogs.microsoft.com/feed/", "blogs.microsoft.com", "Microsoft", primary=True),
    Source("AWS", "https://aws.amazon.com/blogs/machine-learning/feed/", "aws.amazon.com", "Amazon", True, True),
    Source("Amazon", "https://www.aboutamazon.com/news/amazon-ai/rss", "aboutamazon.com", "Amazon", True, True),
    Source("NVIDIA", "https://blogs.nvidia.com/feed/", "blogs.nvidia.com", "NVIDIA", primary=True),
    Source("Apple Newsroom", "https://www.apple.com/newsroom/rss-feed.rss", "apple.com", "Apple", primary=True),
    Source("European Commission", "https://ec.europa.eu/commission/presscorner/api/rss?language=en", "ec.europa.eu", primary=True),
    Source("GOV.UK", "https://www.gov.uk/search/news-and-communications.atom?keywords=artificial+intelligence", "gov.uk", primary=True),
    Source("デジタル庁", "https://www.digital.go.jp/rss/news.xml", "digital.go.jp", primary=True),
    Source("EFF", "https://www.eff.org/rss/updates.xml", "eff.org", primary=True),
    Source("Hugging Face", "https://huggingface.co/blog/feed.xml", "huggingface.co", ai_feed=True, primary=True),
    Source("MIT Technology Review", "https://www.technologyreview.com/topic/artificial-intelligence/feed", "technologyreview.com", ai_feed=True, group="MITTR"),
    Source("MIT Technology Review 日本版", "https://www.technologyreview.jp/feed/", "technologyreview.jp", group="MITTR"),
    Source("TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/", "techcrunch.com", ai_feed=True),
    Source("The Guardian", "https://www.theguardian.com/technology/artificialintelligenceai/rss", "theguardian.com", ai_feed=True),
    Source("Ars Technica", "https://arstechnica.com/ai/feed/", "arstechnica.com", ai_feed=True),
    Source("Publickey", "https://www.publickey1.jp/atom.xml", "publickey1.jp"),
    Source("InfoQ", "https://www.infoq.com/feed/", "infoq.com"),
    Source("South China Morning Post", "https://www.scmp.com/rss/318421/feed", "scmp.com"),
    Source("Rest of World", "https://restofworld.org/feed/latest/", "restofworld.org"),
)


@dataclass(frozen=True)
class Topic:
    name: str
    live: str
    news: str
    reason: str


TOPICS = (
    Topic("個性・判断力", r"個性|偏り|変わり者|標準的な回答|思考力|批判的思考|クリティカル",
          r"human.cent[er]+ed|human judg|autonomy|cogniti|critical think|creativ|personaliz|tailored|homogenei|sycophan|diversity|human agency|consciousness|判断|個性|認知|創造|パーソナライズ|均質|意識",
          "AIに任せる判断と、人が手元に残す判断を考える材料。"),
    Topic("AI規制・利用制限", r"規制|禁止|使えなく|提供停止|サービス停止|アクセス|プライバシ",
          r"regulat|ai act|ai safet|safeguard|privacy|restrict|lawsuit|compliance|outage|block ai|ban ai|ai govern|access control|停止|規制|禁止|ガイドライン|利用制限|安全性",
          "AIを使える条件や、使い方にかかる制約を確認する材料。"),
    Topic("現場のAI導入", r"導入|使われ|利用が進ま|職場|会社で|説得|実装|受託",
          r"adoption|workplace|employees|workflow|organization|enterprise|deployment|roll.?out|integration|implement|training|導入|実証|職場|業務|活用事例|実用|展開",
          "AIを現場で使うときの手順や障害を考える材料。"),
    Topic("仕事の取捨選択", r"なくせる|なくす|手間|効率|自動化|仕事を速く|生産性|ホワイトスペース|時間",
          r"automation|productivity|routine work|repetitive|labou?r|workfl[oa]w|automati[cz]|time sav|仕事|作業|自動化|生産性|時短",
          "時間をかける仕事と、減らせる仕事を見直す材料。"),
    Topic("個人の稼ぎ方", r"マネタイズ|稼|収益|個人に依頼|副業|起業|単一スキル|仕事の変化",
          r"gig work|freelanc|solo founder|creator economy|entrepreneur|small business|income|monetiz|job market|job loss|起業|受注|副業|稼|収益|雇用|報酬|求人",
          "個人がAIで仕事を得る方法や、求められる技能の変化を考える材料。"),
    Topic("AI制作・ツール", r"新機能|新モデル|制作|アプリ|ツール|コーディング|エージェント|生成|リリース",
          r"release|launch|agent|coding|developer|build|model|open source|video generation|アプリ|公開|新機能|モデル|開発|制作|エージェント",
          "制作や検証のやり方に使える選択肢を確認する材料。"),
)

AI_TERM = re.compile(
    r"(?<![a-z])(?:ai|llm|chatgpt|gemini|claude|copilot|deepseek|qwen)(?![a-z])|artificial intelligence|language model|人工知能|ＡＩ",
    re.IGNORECASE,
)
MAJOR_COMPANY = re.compile(
    r"(?<![a-z0-9])(?:openai|chatgpt|google|alphabet|gemini|microsoft|copilot|amazon|aws|nvidia|apple|meta|anthropic|claude|alibaba|qwen|tencent|bytedance|baidu|huawei|samsung|xai)(?![a-z0-9])"
    r"|グーグル|マイクロソフト|アマゾン|エヌビディア|アップル|メタ社|アンソロピック|サムスン|アリババ|ファーウェイ|百度|騰訊",
    re.IGNORECASE,
)
ADVERTISEMENT = re.compile(r"\b(?:sponsor(?:ed)?|advertorial|partner content|paid content)\b|【広告】|【PR】", re.IGNORECASE)
TITLE_NOISE = {"live", "tatsuya", "quant", "log", "youtube", "with", "from", "the", "today", "ニュース", "ライブ配信"}


def fetch(url):
    request = Request(url, headers={"User-Agent": f"QuantLogNews/1.0 (+{PUBLIC_SITE})"})
    with urlopen(request, timeout=14) as response:
        content = response.read(8_000_001)
        if len(content) > 8_000_000:
            raise ValueError("response exceeds size limit")
        return content


def text(value):
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", value or "")).split())


def date(value):
    if not value:
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            result = parsedate_to_datetime(value)
        except (ValueError, TypeError, OverflowError):
            return None
    return (result if result.tzinfo else result.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def source_link(raw, source):
    address = urlsplit(urljoin(source.url, raw))
    host = address.hostname or ""
    if address.scheme != "https" or address.username or not (host == source.host or host.endswith("." + source.host)):
        return ""
    query = urlencode([
        (key, value) for key, value in parse_qsl(address.query, keep_blank_values=True)
        if not key.startswith("utm_")
    ])
    return urlunsplit((address.scheme, address.netloc, address.path, query, ""))


def nodes(value, wanted):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in wanted and isinstance(child, dict):
                yield key, child
            elif isinstance(child, (dict, list)):
                yield from nodes(child, wanted)
    elif isinstance(value, list):
        for child in value:
            yield from nodes(child, wanted)


def live_topics(now, previous):
    try:
        page = fetch(CHANNEL).decode("utf-8")
        match = re.search(r"(?:var\s+)?ytInitialData\s*=\s*", page)
        if not match:
            raise ValueError("live archive page has no data")
        data, _ = json.JSONDecoder().raw_decode(page[match.end():])
        ids = {
            video.get("contentId") if kind == "lockupViewModel" else video.get("videoId")
            for kind, video in nodes(data, {"lockupViewModel", "videoRenderer", "gridVideoRenderer"})
        }
        feed = ET.fromstring(fetch(VIDEO_FEED))
        lives = []
        for entry in feed.findall("{*}entry"):
            video_id = entry.findtext("{*}videoId") or ""
            title = text(entry.findtext("{*}title"))
            published = date(entry.findtext("{*}published"))
            if video_id in ids and re.fullmatch(r"[\w-]{11}", video_id) and title and published and published <= now:
                lives.append({"title": title, "url": f"https://www.youtube.com/watch?v={video_id}", "published": published.isoformat()})
        if not lives:
            raise ValueError("no published live archive appeared in both public lists")
        lives.sort(key=lambda live: live["published"], reverse=True)
        relevant = [live for live in lives if AI_TERM.search(live["title"]) or any(re.search(topic.live, live["title"]) for topic in TOPICS)]
        latest = lives[0]
        return [latest, *(live for live in relevant if live != latest)][:3], False
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"Live archive unavailable: {error}")
        fallback = previous.get("lives", [])
        if not fallback:
            raise
        return fallback, True


def parse_source(source, now):
    try:
        root = ET.fromstring(fetch(source.url))
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"{source.name}: {error}")
        return []
    output = []
    for entry in root.findall(".//{*}item") or root.findall(".//{*}entry"):
        title = text(entry.findtext("{*}title"))
        description = text(entry.findtext("{*}description") or entry.findtext("{*}summary"))
        link = entry.findtext("{*}link")
        if not link:
            link = next((child.get("href") for child in entry.findall("{*}link") if child.get("rel", "alternate") == "alternate"), "")
        url = source_link(link, source) if link else ""
        published = date(entry.findtext("{*}pubDate") or entry.findtext("{*}published") or entry.findtext("{*}date") or entry.findtext("{*}updated"))
        if not (title and url and published and now - timedelta(days=7) <= published <= now):
            continue
        if ADVERTISEMENT.search(title) or ADVERTISEMENT.search(description[:210]):
            continue
        if not (source.ai_feed or AI_TERM.search(title) or AI_TERM.search(description[:360])):
            continue
        output.append({
            "title": title, "url": url, "published": published, "description": description[:450],
            "source": source.name, "group": source.group or source.major or source.name,
            "major": bool(source.major or MAJOR_COMPANY.search(title) or MAJOR_COMPANY.search(urlsplit(url).path)),
            "official": bool(source.major),
            "primary": source.primary,
        })
    return output


def live_keywords(title):
    parts = re.findall(r"[A-Za-z][A-Za-z0-9+-]{2,}|[一-龯]{2,}|[ァ-ヾ]{3,}", title.casefold())
    return {part for part in parts if part not in TITLE_NOISE}


def score_articles(articles, lives, now):
    signals = [
        (topic, weight)
        for index, live in enumerate(lives)
        for topic in TOPICS
        if re.search(topic.live, live["title"])
        for weight in [max(2, 5 - index)]
    ]
    named_terms = set().union(*(live_keywords(live["title"]) for live in lives))
    for article in articles:
        title = article["title"]
        evidence = article["description"]
        topic_scores = []
        for topic, weight in signals:
            headline = re.search(topic.news, title, re.IGNORECASE)
            body = re.search(topic.news, evidence, re.IGNORECASE)
            if headline or body:
                topic_scores.append((weight * (2 if headline else 1), topic))
        relevance, topic = max(topic_scores, default=(0, None), key=lambda pair: pair[0])
        common = live_keywords(title) & named_terms
        article["age"] = (now - article["published"]).total_seconds() / 3600
        article["relevance"] = relevance + min(4, 2 * len(common))
        article["score"] = article["relevance"] * 3 + max(0, 6 - article["age"] / 18) + int(article["primary"])
        article["topic"] = topic.name if topic else "ライブテーマとの共通点" if common else "大手テック"
        article["reason"] = topic.reason if topic else (
            "配信と共通するキーワードを含む記事。" if common else "大手テック企業の最新動向を確認する枠。"
        )
    return sorted(articles, key=lambda article: (article["score"], article["published"]), reverse=True)


def duplicate(article, selected):
    words = live_keywords(article["title"])
    for other in selected:
        if other["url"] == article["url"] or other["group"] == article["group"]:
            return True
        other_words = live_keywords(other["title"])
        if len(words & other_words) >= 3 and len(words & other_words) / min(len(words), len(other_words)) >= 0.7:
            return True
    return False


def select_articles(ranked):
    first_major = next(
        (article for article in ranked if article["official"] and article["age"] <= 96),
        next((article for article in ranked if article["official"]), None),
    )
    if first_major is None:
        raise ValueError("no verifiable major-tech story within seven days")
    selected = [first_major]
    major_count = 1
    for article in ranked:
        if article["age"] > 96 or article["relevance"] < 4 or duplicate(article, selected):
            continue
        if article["major"]:
            if major_count >= 2:
                continue
            major_count += 1
        selected.append(article)
        if len(selected) == 5:
            break
    return sorted(selected, key=lambda article: article["score"], reverse=True)


def run(output, fallback):
    now = datetime.now(timezone.utc)
    previous_path = output if output.exists() else fallback
    previous = json.loads(previous_path.read_text(encoding="utf-8")) if previous_path and previous_path.exists() else {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        live_request = pool.submit(live_topics, now, previous)
        articles = [article for batch in pool.map(lambda source: parse_source(source, now), SOURCES) for article in batch]
        lives, reused_lives = live_request.result()
    if not articles:
        raise ValueError("no source articles available")
    selected = select_articles(score_articles(articles, lives, now))
    # Store links and headlines only. Feed descriptions are used for matching in memory.
    records = [{key: article[key] for key in ("title", "url", "source", "major", "official", "topic", "reason")}
               | {"published": article["published"].isoformat()} for article in selected]
    edition = {"date": now.astimezone(JST).date().isoformat(), "lives": lives, "reusedLives": reused_lives, "articles": records}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(edition, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(f'{edition["date"]}: selected {len(records)} of {len(articles)} candidates, {sum(row["major"] for row in records)} major tech.')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--fallback", type=Path)
    args = parser.parse_args()
    run(args.output, args.fallback)
