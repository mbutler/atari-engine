import {createSound,createVoices,encodeSpeech,AUDC} from '../src/index.mjs';
const $=id=>document.getElementById(id);
let sound=null,voices=null,pcm=null,sourceRate=0,clip=null,playback=null,objectURL=null,version=0;
const effect={control:AUDC.tone,frames:18,at:i=>({frequency:3+i,volume:Math.max(0,10-i)})};
const describe=()=>`${clip.samples.length.toLocaleString()} four-bit samples · ${clip.rate.toLocaleString()} Hz · ${(clip.samples.length/clip.rate).toFixed(2)} seconds`;
const convert=()=>{if(!pcm)return;clip=encodeSpeech(pcm,sourceRate,{rate:Number($('rate').value)});$('status').textContent=describe();};
const stop=()=>{playback=null;voices?.silence();sound?.silence();$('original').pause();if(clip)$('status').textContent=`Stopped · ${describe()}`;};
async function load(bytes,name){
 const request=++version;stop();$('play').disabled=true;$('status').textContent='Decoding voice…';
 const decoded=await sound.context.decodeAudioData(bytes);
 if(request!==version)return;
 pcm=new Float32Array(decoded.length);sourceRate=decoded.sampleRate;
 for(let channel=0;channel<decoded.numberOfChannels;channel++){
  const data=decoded.getChannelData(channel);for(let i=0;i<data.length;i++)pcm[i]+=data[i]/decoded.numberOfChannels;
 }
 convert();$('source-name').textContent=name;$('play').disabled=false;
}
$('enable').onclick=async()=>{
 $('enable').disabled=true;
 try{
  sound=await createSound();await sound.resume();voices=createVoices(sound);
  const response=await fetch('./audio/robot-alert.wav');if(!response.ok)throw new Error('Demo could not be loaded');
  await load(await response.arrayBuffer(),'Robot alert. Prepare for battle. — generated Zarvox demo');
  $('enable').textContent='Speech ready';$('effect').disabled=$('stop').disabled=false;
 }catch(error){if(sound)await sound.destroy();sound=null;voices=null;$('status').textContent=error.message;$('enable').disabled=false;}
};
$('file').onchange=async()=>{
 const file=$('file').files[0];if(!file)return;
 if(!sound){$('status').textContent='Enable speech first, then choose your file.';$('file').value='';return;}
 try{
  await load(await file.arrayBuffer(),file.name);
  if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);$('original').src=objectURL;
 }catch(error){$('status').textContent=`Could not decode that recording: ${error.message}`;}
};
$('rate').onchange=()=>{stop();convert();};
$('play').onclick=async()=>{
 stop();await sound.resume();
 const current=sound.playSample(clip,{channel:0});playback=current;
 $('status').textContent=`Speaking · ${describe()}`;
 const result=await current.finished;
 if(playback===current){playback=null;$('status').textContent=`${result==='ended'?'Finished':'Stopped'} · ${describe()}`;}
};
$('effect').onclick=()=>{voices.play(effect,{channel:1});};
$('stop').onclick=()=>{stop();$('status').textContent=clip?`Stopped · ${describe()}`:'Stopped';};
$('original').onplay=()=>{playback=null;voices?.silence();sound?.silence();};
// Speech runs on the audio clock. This timer advances only the demonstration effect.
const timer=setInterval(()=>voices?.step(),1000/60);
window.addEventListener('blur',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',event=>{stop();if(event.persisted)return;clearInterval(timer);if(objectURL)URL.revokeObjectURL(objectURL);if(sound)void sound.destroy();});
