const AUDIO_SITE_NAME = "QUANT LOG by Tatsuya";

const formatAudioTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
};

const audioCards = [...document.querySelectorAll("[data-audio-card]")];

function setMediaSession(card, audio) {
  if (!("mediaSession" in navigator)) return;
  const title = card.dataset.title || "有料音声";
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist: AUDIO_SITE_NAME,
    album: "有料記事・有料音声",
    artwork: [{ src: "assets/tatsuya-logo.png", sizes: "192x192", type: "image/png" }]
  });
  navigator.mediaSession.setActionHandler("play", () => audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("seekbackward", () => {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  });
  navigator.mediaSession.setActionHandler("seekforward", () => {
    audio.currentTime = Math.min(audio.duration || audio.currentTime + 10, audio.currentTime + 10);
  });
}

audioCards.forEach((card) => {
  const audio = card.querySelector("audio");
  const playButton = card.querySelector("[data-play-toggle]");
  const currentTime = card.querySelector("[data-current-time]");
  const duration = card.querySelector("[data-duration]");
  const seek = card.querySelector("[data-seek]");
  const rate = card.querySelector("[data-rate]");
  const volume = card.querySelector("[data-volume]");
  const fallbackDuration = Number(card.dataset.durationSeconds) || 0;

  audio.volume = Number(volume.value);

  const getDuration = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    return fallbackDuration;
  };

  const updateTime = () => {
    const durationValue = getDuration();
    currentTime.textContent = formatAudioTime(audio.currentTime);
    duration.textContent = formatAudioTime(durationValue);
    if (!seek.matches(":active") && durationValue > 0) {
      seek.value = String((audio.currentTime / durationValue) * 100);
    }
  };

  audio.addEventListener("loadedmetadata", updateTime);
  audio.addEventListener("timeupdate", updateTime);
  audio.addEventListener("play", () => {
    audioCards.forEach((otherCard) => {
      if (otherCard !== card) otherCard.querySelector("audio")?.pause();
      otherCard.removeAttribute("data-playing");
    });
    card.setAttribute("data-playing", "true");
    playButton.textContent = "一時停止";
    setMediaSession(card, audio);
  });
  audio.addEventListener("pause", () => {
    playButton.textContent = "再生";
    if (!audio.ended) card.removeAttribute("data-playing");
  });
  audio.addEventListener("ended", () => {
    playButton.textContent = "再生";
    card.removeAttribute("data-playing");
    seek.value = "0";
  });

  playButton.addEventListener("click", () => {
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  });

  card.querySelectorAll("[data-skip]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.skip);
      const durationValue = getDuration();
      audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), durationValue || audio.currentTime + delta);
    });
  });

  seek.addEventListener("input", () => {
    const durationValue = getDuration();
    if (durationValue <= 0) return;
    audio.currentTime = (Number(seek.value) / 100) * durationValue;
  });

  rate.addEventListener("change", () => {
    audio.playbackRate = Number(rate.value);
  });

  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
  });
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("paid-audio-sw.js").catch(() => {});
}
