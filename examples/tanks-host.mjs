import {createDisplay,createConsole,createLoop,createSound,createVoices,greyscale,PALETTE} from '../src/index.mjs';
import {tanks,RAM} from './tanks.mjs';
import {createTankInputs} from './tanks-controls.mjs';
const stage=document.querySelector('#stage'),canvas=document.querySelector('canvas');
const status=document.querySelector('#state'),pause=document.querySelector('#pause');
const display=createDisplay(canvas,{fit:'integer',within:stage});
const panel=createConsole();
let sound=null,voices=null,disposed=false;
const cart=tanks({voices:{play:(effect,options)=>voices?.play(effect,options)}});
const reset=()=>{voices?.silence();panel.press('Digit2');panel.release('Digit2');loop.setPaused(false);};
const input=createTankInputs({onCommand:command=>command==='pause'?loop.togglePause():reset()});
const GREY=Object.freeze(Object.fromEntries(Object.keys(PALETTE).map(code=>[code,PALETTE[greyscale(Number(code))]])));
let lastStatus='';
const loop=createLoop({input,
 update:read=>{
  const switches=panel.read(),before=cart.mode;
  if(switches.reset)voices?.silence();
  cart.update(read,switches);
  if(before!==1&&cart.mode===1)voices?.silence();
  voices?.step();
 },
 render:()=>{
  const switches=panel.peek(),frame=cart.render();
  frame.palette=switches.color?PALETTE:GREY;display.present(frame);
  const mode=cart.mode===0?'Space or Enter to start':cart.winner?`${cart.winner==='draw'?'Draw':cart.winner==='left'?'Blue wins':'Red wins'} — Space or Enter to play again`:'First to five';
  const text=`${cart.ram[RAM.score]} : ${cart.ram[RAM.score+1]} · ${mode} · ${cart.ram[RAM.variation]?'Cover':'Open field'} · Left ${switches.difficulty.left.toUpperCase()} / Right ${switches.difficulty.right.toUpperCase()}`;
  if(text!==lastStatus){status.textContent=text;lastStatus=text;}
 },
 onPause:paused=>{
  stage.classList.toggle('paused',paused);pause.textContent=paused?'Resume':'Pause';
  if(paused){panel.clear();voices?.silence();}
 },
});
document.querySelector('#start').onclick=reset;
pause.onclick=()=>loop.togglePause();
document.querySelector('#full').onclick=()=>display.toggleFullscreen().catch(error=>{status.textContent=error.message;lastStatus='';});
document.querySelector('#sound').onclick=async event=>{
 const button=event.currentTarget;button.disabled=true;
 try{
  sound=await createSound();await sound.resume();
  if(disposed){await sound.destroy();return;}
  voices=createVoices(sound);button.textContent='Sound on';
 }catch(error){
  if(sound)await sound.destroy();sound=null;
  button.textContent='Retry sound';button.disabled=false;status.textContent=`Sound unavailable: ${error.message}`;
 }
};
window.addEventListener('pagehide',event=>{
 if(event.persisted)return;
 disposed=true;loop.destroy();input.destroy();panel.destroy();display.destroy();
 if(sound)void sound.destroy();
});
loop.start();
