# Persona Appendix, a SillyTavern Extension

### But why? 
Have you ever felt that you liked a base persona (literally you) but although you wanted to play some card, the advanced details of your character would NOT work with it? Like a modern character being in a fantsy jungle, it can work as isekai but what if you wanted to play otherwise? 

Enter the appendix. 

You no longer have to go through the laborous process of either duplicating the persona or removing/editing it nonstop to make it fit the chats you want. It is a pure convenience thing.

### Features 

- Add as many notes as you want, however many you want. 
    - All these notes will be appended to your persona and sent with them.
- Fuzzy Searching 
- Three stages, global, character, chat
- Can turn off and on. The ones that are on GLOW.
- You can set the glow's color. 
- Draggable (Questionable, will remove it soon)
- Import/export (but why?)

### To FIX 
- Either remove or fix the drag... ugh.
- The notes still do a resize whenver you switch tabs or turn them on and off, it is a pain in the ass to fix, but the resizing is necessary and needed unfortunately...
- The blasted info are saved in the 69MB ahh settings.json file every single extension in eistence uses. Sure... it works... but it will also pollute it faster than everybody because of its nature, and digging through that shit is just inhumane to my users. 

Vibe coded one angry morning, I make NO guarantee you will not run head first into bugs.


### But WAIT BRUH 
"I just checked the source code and there are like 9 safety net to cleanup the injected text, wtf is the point?"
The point, dear reader, is that ST source code is genuinely cursed. 
I fucking tried. 

GENERATIE_BEFORE_PROMPTS flat out doesn't work as an event source. It literally wouldn't inject. 

AND THESE TWO:
GENERATIE_AFTER_PROMPTS fires TWICE. 
GENERATION_STARTED does a dryrun ONCE regardless. 

THEY ALWAYS FUCKED UP THE PERSONA FIELD if you just refreshed WITHOUT GENERATION of ANY kind. it was fucking exhausting. So I threw caution to wind, started burning down all the exit routes AND setup a timer bomb. Because fuck having reliable event signals, I guess?
I had to be insane. 
If you can patch it better than me? You are welcome to try. 
