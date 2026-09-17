// A physical stick, read through the Gamepad API. Axes have no events, so the pad is
// polled on each read rather than listened to. The digital reading matches the
// keyboard's, so a cartridge cannot tell them apart; `analog` is the raw stick for
// games that want a continuous control, which is the nearest thing to a paddle most
// people still have. Integrate analog.x over time to get a paddle's absolute position:
// a stick springs back to centre, so treating it as a position instead of a rate
// snaps the bat to the middle every time the player lets go.
export function createGamepad({index=0,deadzone=.25,buttons=[0,1],axes=[0,1],pads=null}={}){
 if(!(deadzone>=0&&deadzone<1))throw new RangeError('Deadzone must be at least 0 and below 1');
 let pending=false,wasDown=false;
 // `pads` names the source of connected pads, so this runs without a browser.
 const list=pads||(()=>globalThis.navigator&&globalThis.navigator.getGamepads?globalThis.navigator.getGamepads():[]);
 const pad=()=>{const found=(list()||[])[index];return found&&found.connected?found:null;};
 const past=value=>Math.abs(value)<deadzone?0:value;
 const gamepad={
  get connected(){return !!pad();},
  read(){
   const source=pad();
   if(!source){const tapped=pending;pending=false;wasDown=false;return {x:0,y:0,action:tapped,analog:{x:0,y:0}};}
   const down=buttons.some(button=>{const b=source.buttons[button];return !!b&&(typeof b==='object'?b.pressed:b>.5);});
   if(down&&!wasDown)pending=true;
   wasDown=down;
   const held=button=>{const b=source.buttons[button];return Number(!!b&&(typeof b==='object'?b.pressed:b>.5));};
   const analog={x:past(source.axes[axes[0]]||0),y:past(source.axes[axes[1]]||0)};
   // Standard mapping puts the d-pad on 12 up, 13 down, 14 left, 15 right. The stick
   // only speaks when the d-pad is quiet. Axis Y is positive downward, as `read` is.
   const action=down||pending;pending=false;
   return {x:(held(15)-held(14))||Math.sign(analog.x),y:(held(13)-held(12))||Math.sign(analog.y),action,analog};
  },
  clear(){pending=false;wasDown=false;},
  destroy(){gamepad.clear();},
 };
 return gamepad;
}
