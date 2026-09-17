// The machine's front panel, which is not the controller. Select and Reset are
// momentary buttons; Color and the two difficulty switches are toggles a player
// sets before playing. Cycling numbered variations with Select is core 2600 UX --
// Combat ships 27 of them, Space Invaders 112 -- so a faithful game needs this.
// The switches sit on one row of keys because they sit in one row on the console.
export const SWITCHES=Object.freeze({Digit1:'select',Digit2:'reset',Digit3:'color',Digit4:'left',Digit5:'right'});
const MOMENTARY=new Set(['select','reset']);
export function createConsole({target=document,keys=SWITCHES,onSwitch=()=>{}}={}){
 const held=new Set(),pending=new Set();
 const state={color:true,left:'b',right:'b'};
 const announce=(name,value)=>{onSwitch(name,value);};
 const flip=name=>{
  if(name==='color'){state.color=!state.color;announce('color',state.color);return;}
  state[name]=state[name]==='a'?'b':'a';announce(name,state[name]);
 };
 // A momentary switch latches so a tap between two reads is never missed, the same
 // way the controller's action button does. A toggle flips once per press, not per
 // key repeat. Holding Select keeps reading true, which is how real consoles run
 // through variations; a game that wants one step per press debounces it itself.
 const press=code=>{
  const name=keys[code];if(!name)return;
  if(MOMENTARY.has(name)){if(!held.has(code))pending.add(name);held.add(code);return;}
  if(!held.has(code)){held.add(code);flip(name);}
 };
 const release=code=>held.delete(code);
 const down=event=>{if(keys[event.code]){event.preventDefault();press(event.code);}};
 const up=event=>release(event.code);
 target.addEventListener('keydown',down);target.addEventListener('keyup',up);
 const down_=name=>{for(const code of held)if(keys[code]===name)return true;return false;};
 return {
  press,release,
  read(){
   const panel={select:down_('select')||pending.has('select'),reset:down_('reset')||pending.has('reset'),
                color:state.color,difficulty:{left:state.left,right:state.right}};
   pending.clear();return panel;
  },
  // Flipping a switch from a host's own interface rather than the keyboard.
  set({color,left,right}={}){
   if(color!==undefined&&!!color!==state.color)flip('color');
   for(const [name,value] of [['left',left],['right',right]]){
    if(value===undefined)continue;
    if(value!=='a'&&value!=='b')throw new RangeError('Difficulty must be "a" or "b"');
    if(value!==state[name])flip(name);
   }
   return this;
  },
  clear(){held.clear();pending.clear();},
  destroy(){target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);held.clear();pending.clear();},
 };
}
