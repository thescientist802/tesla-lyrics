const lyrics = [
    { time: 27.68, text: "Come up to meet you, tell you I'm sorry" },
    { time: 34.13, text: "You don't know how lovely you are" },
    { time: 41.11, text: "I had to find you, tell you I need you" },
    { time: 47.45, text: "Tell you I set you apart" },
    { time: 54.12, text: "Tell me your secrets and ask me your questions" },
    { time: 60.58, text: "Oh, let's go back to the start" },
    { time: 66.97, text: "Running in circles, coming up tails" },
    { time: 73.76, text: "Heads on a science apart" },
    { time: 79.79, text: "Nobody said it was easy" },
    { time: 86.53, text: "It's such a shame for us to part" },
    { time: 92.88, text: "Nobody said it was easy" },
    { time: 99.47, text: "No one ever said it would be this hard" },
    { time: 108.35, text: "Oh, take me back to the start" },

    { time: 139.33, text: "I was just guessing at numbers and figures" },
    { time: 145.65, text: "Pulling the puzzles apart" },
    { time: 152.44, text: "Questions of science, science and progress" },
    { time: 158.61, text: "Do not speak as loud as my heart" },
    { time: 165.06, text: "But tell me you love me, come back and haunt me" },
    { time: 172.17, text: "Oh and I rush to the start" },
    { time: 178.51, text: "Running in circles, chasing our tails" },
    { time: 185.09, text: "Coming back as we are" },
    { time: 191.75, text: "Nobody said it was easy" },
    { time: 197.91, text: "Oh, it's such a shame for us to part" },
    { time: 204.73, text: "Nobody said it was easy" },
    { time: 210.92, text: "No one ever said it would be so hard" },
    { time: 219.98, text: "I'm going back to the start" }
];

let currentMs = 10;
let currentSec = currentMs / 1000;

console.log(currentMs)

setInterval(() => {
    currentMs += 100;
    currentSec = currentMs / 1000;
    updateLyrics(currentSec);
}, 100);

setInterval(() => {
    document.getElementById("timer").textContent = currentSec; 
}, 100);

let currentLyricIndex = 0;

function updateLyrics(time) {
    if(lyrics[currentLyricIndex].time <= time) {
        document.getElementById("lyric-display").textContent = lyrics[currentLyricIndex].text;
        currentLyricIndex++;
    }
}

const reset = document.getElementById("reset-button");

console.log(reset)

reset.addEventListener("click", () => {
    currentMs = 0;
    currentSec = 0;
    currentLyricIndex = 0;
    document.getElementById("lyric-display").textContent = "...";
    document.getElementById("timer").textContent = "0.0";
});
