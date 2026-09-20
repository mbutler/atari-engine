// Cartridge-owned audio -> the TIA's sixteen volume levels. The rate is a
// cartridge choice; 8 kHz is a useful starting point, not a Berzerk timing claim.
export function encodeSpeech(pcm,sourceRate,{rate=8000}={}){
 if(!(pcm instanceof Float32Array)||!pcm.length||pcm.some(v=>!Number.isFinite(v)))throw new TypeError('Speech needs nonempty finite mono Float32 PCM');
 for(const value of [sourceRate,rate])if(!Number.isFinite(value)||value<=0||value>96000)throw new RangeError('Audio rates must be positive and at most 96000 Hz');
 const samples=new Uint8Array(Math.ceil(pcm.length*rate/sourceRate));
 const ratio=sourceRate/rate;
 for(let i=0;i<samples.length;i++){
  // Average the source interval when reducing rate, rather than discarding all
  // but one input sample. This simple box filter is not a studio resampler.
  const start=i*ratio,end=Math.min(pcm.length,(i+1)*ratio);let sum=0;
  for(let j=Math.floor(start);j<Math.ceil(end);j++)sum+=pcm[j]*(Math.min(end,j+1)-Math.max(start,j));
  const value=sum/(end-start);
  samples[i]=Math.round((Math.max(-1,Math.min(1,value))+1)*7.5);
 }
 return {samples,rate};
}
