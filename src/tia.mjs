// The TIA's two audio channels, as the hardware actually builds them: a frequency
// divider feeding polynomial counters. Reproducing the real circuit is easier here
// than approximating it, and the coarse 5-bit divider is what makes 2600 music sit
// audibly out of tune. That detuning is the sound, so it is not corrected.
//
// createTiaChip is deliberately self-contained, with every constant declared inside
// it. src/sound.mjs stringifies this function to build an AudioWorklet, so it must
// not close over anything at module scope.
export function createTiaChip(sampleRate,{gain=1,lowPass=10000,highPass=20}={}){
 const CLOCK=3579545/114; // 31399.5 Hz: two audio clocks per NTSC scanline.
 // The divide-by-31 output pattern. Its period is odd, so it cannot be a symmetric
 // square wave, and that lopsidedness is why "div 31" buzzes instead of whistling.
 const DIV31=[0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0];
 const lpK=lowPass?1-Math.exp(-2*Math.PI*lowPass/sampleRate):1;
 const hpR=highPass?Math.exp(-2*Math.PI*highPass/sampleRate):0;
 const fresh=()=>({control:0,frequency:0,volume:0,count:0,p4:1,p5:1,p9:1,by3:0,at31:0,count31:0,out:1});
 const chan=[fresh(),fresh()];
 let phase=0,lowZ=0,highX=0,highY=0;
 // Maximal-length shift registers: 15, 31 and 511 steps before they repeat.
 const poly4=c=>{c.p4=(c.p4>>1)|(((c.p4^(c.p4>>1))&1)<<3);return c.p4&1;};
 const poly5=c=>{c.p5=(c.p5>>1)|(((c.p5^(c.p5>>2))&1)<<4);return c.p5&1;};
 const poly9=c=>{c.p9=(c.p9>>1)|(((c.p9^(c.p9>>4))&1)<<8);return c.p9&1;};
 const div31=c=>DIV31[c.at31=(c.at31+1)%31];
 const by3=c=>{if(++c.by3<3)return false;c.by3=0;return true;};
 // AUDC selects how the counters are wired together. Stella's programmer guide
 // names these; several settings are duplicates on real hardware.
 function shape(c){
  switch(c.control){
   case 0: case 11: c.out=1;break;                              // constant: silence once DC is blocked
   case 1: c.out=poly4(c);break;                                // 4-bit poly
   case 2: if(++c.count31>=31){c.count31=0;c.out=poly4(c);}break;// div 31 into 4-bit poly
   case 3: if(poly5(c))c.out=poly4(c);break;                    // 5-bit poly gates 4-bit poly
   case 4: case 5: c.out^=1;break;                              // div 2: pure tone
   case 6: case 10: c.out=div31(c);break;                       // div 31
   case 7: if(poly5(c))c.out^=1;break;                          // 5-bit poly gates div 2
   case 8: c.out=poly9(c);break;                                // 9-bit poly: white noise
   case 9: c.out=poly5(c);break;                                // 5-bit poly
   case 12: case 13: if(by3(c))c.out^=1;break;                  // div 6
   case 14: if(by3(c))c.out=div31(c);break;                     // div 93
   case 15: if(poly5(c)&&by3(c))c.out^=1;break;                 // 5-bit poly gates div 6
  }
 }
 // One TIA audio clock. The divider is AUDF+1, so pitch is quantised to 32 steps.
 function tick(){for(let i=0;i<2;i++){const c=chan[i];if(++c.count>c.frequency){c.count=0;shape(c);}}}
 const level=()=>chan[0].out*chan[0].volume+chan[1].out*chan[1].volume;
 return {
  CLOCK,tick,level,
  write({channel=0,control,frequency,volume}){
   const c=chan[channel];if(!c)return;
   if(control!==undefined)c.control=control&15;
   if(frequency!==undefined)c.frequency=frequency&31;
   if(volume!==undefined)c.volume=volume&15;
  },
  reset(){chan[0]=fresh();chan[1]=fresh();phase=lowZ=highX=highY=0;},
  // Zero-order hold from the 31.4 kHz chip rate up to the audio device rate, which
  // is what the real stepped output does, then the analog stages after it.
  render(out){
   for(let i=0;i<out.length;i++){
    phase+=CLOCK/sampleRate;
    while(phase>=1){phase-=1;tick();}
    const x=(chan[0].out*chan[0].volume+chan[1].out*chan[1].volume)/30;
    highY=x-highX+hpR*highY;highX=x;   // output coupling blocks the DC offset
    lowZ+=(highY-lowZ)*lpK;            // a television speaker rolls off the top end
    out[i]=lowZ*gain;
   }
  },
 };
}
// The audio clock, for tools that need to reason about pitch on the main thread.
export const AUDIO_CLOCK=3579545/114;
// Output period, in channel clocks, of the settings that make a pure tone. The
// poly settings are noise and have no pitch.
export const TONES=Object.freeze({4:2,5:2,6:31,10:31,12:6,13:6,14:93});
// Nearest AUDF for a wanted pitch, with the error it lands on. The 2600 cannot
// play in tune; this reports how far off it is rather than hiding it.
export function pitch(control,hz){
 const period=TONES[control];
 if(!period)throw new RangeError(`Control ${control} is noise, not a pure tone. Pitched settings are ${Object.keys(TONES).join(', ')}`);
 if(!(hz>0))throw new RangeError('Pitch requires a positive frequency');
 let best=null;
 for(let frequency=0;frequency<32;frequency++){
  const actual=AUDIO_CLOCK/((frequency+1)*period),cents=1200*Math.log2(actual/hz);
  if(!best||Math.abs(cents)<Math.abs(best.cents))best={frequency,hz:actual,cents};
 }
 return {frequency:best.frequency,hz:Math.round(best.hz*100)/100,cents:Math.round(best.cents*10)/10};
}
