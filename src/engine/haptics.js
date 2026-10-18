export function vibrate(pattern=22){if(localStorage.getItem('paper-io-vibration')==='false')return;try{navigator.vibrate?.(pattern);}catch{}}
