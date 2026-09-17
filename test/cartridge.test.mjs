import test from 'node:test';
import assert from 'node:assert/strict';
import {catcher,RAM,RAM_USED,art} from '../examples/cartridge.mjs';
import {TIA_BUDGET} from '../src/index.mjs';
const PANEL={select:false,reset:false,color:true,difficulty:{left:'b',right:'b'}};
const STILL={x:0,y:0,action:false};
// The simulation is a deterministic fixed step with no hidden state, so a recorded
// input tape replays exactly. This is the one advantage a cartridge has here that it
// would not have had in 1982, and it is what makes a game testable at all.
function tape(frames,{difficulty='b',variation=0,chase=true}={}){
 const cart=catcher();
 cart.update(STILL,{...PANEL,reset:true});
 cart.ram[RAM.variation]=variation;
 let peak=0;
 for(let i=0;i<frames;i++){
  const frame=cart.render();
  for(let line=0;line<192;line++){
   const sprites=frame.commands.filter(c=>c.kind==='sprite'&&line>=c.y&&line<c.y+c.height).length;
   const missiles=frame.commands.filter(c=>c.kind==='missile'&&line>=c.y&&line<c.y+c.height).length;
   assert.ok(sprites<=TIA_BUDGET.sprites,`scanline ${line} drew ${sprites} players at frame ${i}`);
   assert.ok(missiles<=TIA_BUDGET.missiles,`scanline ${line} drew ${missiles} missiles at frame ${i}`);
   peak=Math.max(peak,sprites);
  }
  let target=-1;
  for(let j=0;j<3;j++)if(cart.ram[RAM.fallerLive+j]&&(target<0||cart.ram[RAM.fallerY+j]>cart.ram[RAM.fallerY+target]))target=j;
  const want=chase&&target>=0?Math.sign(cart.ram[RAM.fallerX+target]-cart.ram[RAM.catcherX]):0;
  cart.update({x:want,y:0,action:false},{...PANEL,difficulty:{left:difficulty,right:'b'}});
 }
 return {cart,peak};
}
test('the cartridge holds itself to 1982 scope',()=>{
 assert.ok(RAM_USED<=128,`${RAM_USED} bytes is more state than a 2600 had`);
 assert.ok(RAM_USED<=100,'the stack shares the 128 bytes, so leave room for it');
 // Every byte it uses is named, so nothing is being tracked off the books.
 assert.equal(new Set(Object.values(RAM)).size,Object.values(RAM).length,'two fields share a byte');
 assert.ok(Math.max(...Object.values(RAM))<RAM_USED);
 for(const glyph of Object.values(art))assert.equal(glyph.length,8,'sprites are eight rows of players');
});
test('a game plays out and ends without ever exceeding the hardware',()=>{
 const {cart,peak}=tape(4000);
 assert.equal(peak,2,'two players is the whole budget, and it is used');
 assert.equal(cart.mode,2,'a session ends rather than running forever');
 assert.ok(cart.score>10,`a chasing player should score more than ${cart.score}`);
 assert.equal(cart.ram[RAM.lives],0);
});
test('every position stays a whole pixel',()=>{
 const {cart}=tape(900);
 for(const key of ['catcherX','fallerX','fallerY'])
  for(let i=0;i<3;i++)assert.ok(Number.isInteger(cart.ram[RAM[key]+i]),`${key} drifted off the pixel grid`);
 // A Uint8Array cannot hold a fraction, which is the point of keeping state in one.
 assert.ok(cart.ram instanceof Uint8Array);
});
test('the difficulty switch and the variations actually change the game',()=>{
 const novice=tape(2400,{difficulty:'b'}).cart.score;
 const expert=tape(2400,{difficulty:'a'}).cart.score;
 assert.ok(expert<novice,`expert (${expert}) should be harder than novice (${novice})`);
 // Variation 1 drops things faster; variation 2 narrows the catcher.
 const plain=tape(2400).cart,narrow=tape(2400,{variation:2}).cart;
 assert.ok(narrow.score<plain.score,'a narrower catcher should catch less');
});
test('the same input tape always produces the same game',()=>{
 const first=tape(1500),second=tape(1500);
 assert.equal(first.cart.score,second.cart.score);
 assert.deepEqual([...first.cart.ram],[...second.cart.ram],'the run is reproducible byte for byte');
});
test('Select cycles variations and Reset starts a game',()=>{
 const cart=catcher();
 assert.equal(cart.mode,0,'it comes up in attract');
 for(let i=1;i<=4;i++){
  cart.update(STILL,{...PANEL,select:true});
  assert.equal(cart.ram[RAM.variation],i&3,'Select wraps through the variations');
 }
 cart.update(STILL,{...PANEL,reset:true});
 assert.equal(cart.mode,1);
 assert.equal(cart.ram[RAM.lives],3);
 assert.equal(cart.score,0);
});
test('the catcher stays on screen once the game-over flash has run out',()=>{
 const cart=catcher();
 cart.update(STILL,{...PANEL,reset:true});
 cart.ram[RAM.lives]=1;
 // Drop a faller onto the floor to end the game.
 cart.ram[RAM.fallerLive]=1;cart.ram[RAM.fallerY]=200;cart.ram[RAM.fallerX]=20;
 cart.update(STILL,PANEL);
 assert.equal(cart.mode,2,'that was the last life');
 const drawn=()=>cart.render().commands.some(c=>c.kind==='sprite');
 let blinked=false;
 for(let i=0;i<40;i++){if(!drawn())blinked=true;cart.update(STILL,PANEL);}
 assert.ok(blinked,'it should blink while the flash runs');
 assert.equal(cart.ram[RAM.flash],0,'and the flash should finish');
 assert.ok(drawn(),'after which the catcher is visible again, not gone for good');
});
