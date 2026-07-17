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
    { time: 108.35, text: "Oh, take me back to the start" }
];


let currentMs = 0;
let currentSec = 0;

let currentLyricIndex = 0;


const lyricElement = document.getElementById("current-lyric");
const timerElement = document.getElementById("timer");



setInterval(() => {

    currentMs += 100;
    currentSec = currentMs / 1000;

    updateLyrics(currentSec);

}, 100);



setInterval(() => {

    timerElement.textContent = currentSec.toFixed(1);

}, 100);




function updateLyrics(time) {

    if (
        currentLyricIndex < lyrics.length &&
        lyrics[currentLyricIndex].time <= time
    ) {


        animateLyricChange(
            lyrics[currentLyricIndex].text
        );


        currentLyricIndex++;

    }

}




function animateLyricChange(newText) {


    // Move current lyric up and fade out
    gsap.to(lyricElement, {

        y: -40,

        opacity: 0,

        duration: 0.4,

        ease: "power2.in",

        onComplete: () => {


            // Change text after it disappears
            lyricElement.textContent = newText;



            // Bring new lyric from below
            gsap.fromTo(
                lyricElement,

                {
                    y: 40,
                    opacity: 0
                },

                {
                    y: 0,
                    opacity: 1,
                    duration: 0.6,
                    ease: "power3.out"
                }
            );

        }

    });

}





const reset = document.getElementById("reset-button");


reset.addEventListener("click", () => {


    currentMs = 0;

    currentSec = 0;

    currentLyricIndex = 0;


    lyricElement.textContent = "...";

    timerElement.textContent = "0.0";


    // reset animation position
    gsap.set(lyricElement, {
        y:0,
        opacity:1
    });

});