import test from 'node:test';
import assert from 'node:assert/strict';
import {createTiaChip,AUDIO_CLOCK,pitch} from '../src/index.mjs';
// Runs one channel alone and measures how many channel clocks its output takes to repeat.
function period(control,frequency=0){
 const chip=createTiaChip(48000);
 chip.write({channel:0,control,frequency,volume:15});chip.write({channel:1,volume:0});
 const seq=[];for(let i=0;i<8000;i++){chip.tick();seq.push(chip.level());}
 const tail=seq.slice(2000);
 for(let p=1;p<=1500;p++){let ok=true;for(let i=0;i<2000&&ok;i++)if(tail[i]!==tail[i+p])ok=false;if(ok)return p;}
 return null;
}
test('pure tone settings divide the audio clock by their documented ratios',()=>{
 assert.equal(period(4),2);    // div 2
 assert.equal(period(5),2);    // duplicate of 4 on real hardware
 assert.equal(period(12),6);   // div 6
 assert.equal(period(13),6);
 assert.equal(period(6),31);   // div 31
 assert.equal(period(10),31);
 assert.equal(period(14),93);  // div 93
});
test('the polynomial counters run their full maximal length',()=>{
 assert.equal(period(1),15);   // 4-bit poly
 assert.equal(period(9),31);   // 5-bit poly
 assert.equal(period(8),511);  // 9-bit poly, the white noise setting
});
test('the frequency divider is AUDF plus one',()=>{
 for(const f of [0,1,3,7,31])assert.equal(period(4,f),2*(f+1));
 // 15.7 kHz at AUDF 0 is the highest pitch the hardware reaches.
 assert.equal(Math.round(AUDIO_CLOCK/2),15700);
});
test('silent settings and zero volume produce no signal',()=>{
 for(const control of [0,11]){const chip=createTiaChip(48000);chip.write({channel:0,control,frequency:4,volume:15});
  const out=new Float32Array(16384);chip.render(out);
  // A constant level is blocked by the output coupling. That takes a few hundred
  // samples to settle, exactly as the real coupling capacitor does.
  assert.ok(Math.max(...out.slice(8192).map(Math.abs))<1e-4,`control ${control} should settle to silence`);}
 const chip=createTiaChip(48000);chip.write({channel:0,control:4,frequency:4,volume:0});
 const out=new Float32Array(2048);chip.render(out);
 assert.deepEqual([...new Set(out)],[0]);
});
test('rendered audio stays inside the available headroom',()=>{
 const chip=createTiaChip(48000);
 chip.write({channel:0,control:4,frequency:2,volume:15});chip.write({channel:1,control:8,frequency:5,volume:15});
 const out=new Float32Array(48000);chip.render(out);
 assert.ok(out.every(Number.isFinite));
 assert.ok(Math.max(...out.map(Math.abs))<=1,'two channels at full volume must not clip');
 assert.ok(Math.max(...out.map(Math.abs))>.05,'and must actually be audible');
});
test('registers are independent per channel and reset clears them',()=>{
 const chip=createTiaChip(48000);
 chip.write({channel:0,control:4,frequency:1,volume:15});
 chip.write({channel:1,control:4,frequency:1,volume:15});
 let both=0;for(let i=0;i<64;i++){chip.tick();both=Math.max(both,chip.level());}
 assert.equal(both,30);
 chip.write({channel:1,volume:0});
 let one=0;for(let i=0;i<64;i++){chip.tick();one=Math.max(one,chip.level());}
 assert.equal(one,15);
 chip.reset();
 assert.equal(chip.level(),0);
});
test('pitch finds the nearest playable note and reports the error honestly',()=>{
 const a=pitch(12,440);
 assert.equal(a.frequency,11);
 assert.ok(Math.abs(a.hz-436.1)<.1);
 // The divider is coarse, so concert pitch is out of reach. That is the sound.
 assert.ok(a.cents<-10&&a.cents>-20,`A440 lands ${a.cents} cents off`);
 assert.equal(Math.round(AUDIO_CLOCK/((a.frequency+1)*6)*100)/100,a.hz);
 // Every pitched setting must return a legal register value.
 for(const control of [4,5,6,10,12,13,14])for(const hz of [110,220,440,880]){
  const found=pitch(control,hz);
  assert.ok(Number.isInteger(found.frequency)&&found.frequency>=0&&found.frequency<32);
 }
 // Noise settings have no pitch and say so rather than guessing.
 for(const control of [1,3,8,9])assert.throws(()=>pitch(control,440),/not a pure tone/);
});
