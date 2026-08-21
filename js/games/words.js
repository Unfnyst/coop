// ─── words.js ───────────────────────────────────────────────────────────
// A local list of common English words so Anagrams works instantly and
// offline. Anything not in here gets a second opinion from the free
// dictionaryapi.dev — so real words still count, they just take a moment.

const RAW = `
ace ache aches acid acids acorn acre acres act acted actor acts add adds ado
adobe adopt adore ads aft after age aged agent ages ago aid aide aides aids ail
aim aims air aired airs aisle ale alert alien align alike alive all alley allow
alloy almond alms aloe alone along aloud alpha also altar alter alto amble amber
amend amid amide among ample amuse ancient and anger angel angle angles angry
anima animal ankle annoy ant ante anthem ants anvil any apart ape apes apex apple
apply apron apt arc arch arches arcs are area areas arena argue arid arise arm
armed armies armor arms army aroma arose around arrow arson art artist arts ash
ashen aside ask asked asks asleep aspen aster astir ate atlas atom atoms atone
attic auto autos avert avoid await awake award aware away awe awful axe axes axis
babe baby back backed bacon bad badge badly bag bags bail bait bake baked baker
bakes bald bale ball balm balmy ban banal band bands bane bang bank banks bar bard
bare barge bark barn barns barrel bars base based bases basic basil basin basket
bass bat batch bath bathe bats batter bay bays beach bead beads beam beams bean
beans bear beard bears beast beat beaten beats beauty became become bed beds bee
beef been beer bees beet beetle before beg began begin begun behind being belt
belts bench bend bends beneath bent berry beside best bet bets better between
beyond bib bid bids big bike bikes bile bill bills bin bind binds bird birds birth
bit bite bites bitter black blade blame bland blank blast blaze bleak bleed blend
bless blew blind blink bliss block blond blood bloom blot blow blue bluff blunt
blur blush board boast boat boats bob bode body boil boiled bold bolt bolts bomb
bond bone bones bonus book books boom boost boot boots border bore bored born
borne borrow boss both bother bottle bough bought bounce bound bow bowl bowls box
boxes boy boys brace braid brain brake bran branch brand brass brave bread break
breath breed brew bribe brick bride bridge brief bright brim bring brink brisk
broad broil broke bronze brook broom broth brow brown bruise brush brute bubble
buck bucket bud budge buffalo bug bugs build built bulb bulk bull bump bun bunch
bundle bunk buoy burden burn burnt burst bury bus bush busy but butter button buy
buzz by cab cabin cable cadet cafe cage cake cakes calf call calm came camel camp
can canal candle cane canoe canvas cap cape caper capital car carbon card cards
care cargo carol carpet carry cars cart carve case cash cask cast castle cat catch
cattle caught cause cave caves cease cedar ceiling cell cellar cement cent center
cereal chain chair chalk champ chance change chant chaos chap chapter char charge
charm chart chase chat cheap cheat check cheek cheer cheese chef cherry chess chest
chew chick chief child chill chime chin china chip chirp choice choir choke choose
chop chord chore chose chosen chunk churn cider cigar cinema circle circus cite
city civic civil claim clam clan clap clash clasp class claw clay clean clear clerk
clever click cliff climb cling clip cloak clock clone close cloth cloud clover clown
club clue clump clung coach coal coast coat coax cobra cocoa code coded codes coffee
coil coin coins cold collar colony color colt column comb combat come comet comic
comma common cone confess coral cord core cork corn corner correct cost cot cottage
cotton couch cough could count county couple course court cousin cover cow coward
cowboy cows coy cozy crab crack cradle craft crag cram crane crash crate crave crawl
crayon crazy cream creek creep crest crew crib cried crime crisp crop cross crow
crowd crown crude cruel crumb crush crust cry cub cube cubic cue cuff cult cup cups
curb curd cure curl curly curse curve cushion cut cute cycle dad daily dairy daisy
dam damage damp dance dandy danger dare dark darn dart dash data date dawn day days
dead deaf deal dealt dean dear death debate debt decade decay deck decor deed deep
deer defeat defend defy degree delay delta demand den dense dent deny depart depend
depth derby desert design desk detail detect device devil dial diary dice diet dig
digit dim dime dine diner dinner dip dire dirt dirty disc dish disk ditch dive divide
dizzy dock doctor dodge doe does dog dogs doll dollar dome domain done donkey door
doors dose dot dots double doubt dough dove down dozen draft drag dragon drain drama
drank drape draw drawn dread dream dress drew dried drift drill drink drip drive drop
drove drown drug drum dry duck due duel duet dug duke dull duly dumb dump dune dusk
dust duty dwarf dwell dye each eager eagle ear early earn earth ease east easy eat
eaten eats echo edge edges edit editor eel effect effort egg eggs eight either elbow
elder elect eleven elf elm else elude email embark ember emblem embrace emerge emit
empire employ empty enable enact end ending endure enemy energy engage engine enjoy
enlist enough enter entire entry envelope envy equal equip era erase erode error erupt
escape essay estate etch eternal even event ever every evict evil exact exam exceed
excel excess excite exclaim excuse exert exhale exile exist exit expand expect expert
expire explain export expose extend extra eye eyes fable fabric face faces fact factor
fade fail faint fair fairy faith fake fall false fame family famous fan fancy fang far
fare farm farmer fast fat fatal fate father fault favor fear feast feather fee feed
feel feet fell fellow felt female fence fern ferry fetch fever few fiber field fierce
fifth fifty fig fight figure file fill film filter final finch find fine finger finish
fir fire firm first fish fist fit five fix flag flake flame flap flash flat flavor flaw
flea fled flee fleet flesh flew flex flight fling flint flip float flock flood floor
flour flow flower fluid flute fly foam focus fog fold folk follow fond food fool foot
for force ford forest forge fork form formal fort forth forty forum forward fossil
foster fought foul found four fourth fox fraction fragile frame frank fraud free freeze
fresh friend fright fringe frog from front frost frown froze fruit fry fudge fuel full
fun fund funny fur furnace fury fuse future fuzzy gain gait gale gallon game games gang
gap garage garden garlic gas gasp gate gather gauge gave gaze gear gem gene general
gentle genuine germ get ghost giant gift gill gilt girl give given glad glance gland
glare glass gleam glide glint globe gloom glory glove glow glue goal goat god goes gold
golf gone good goose gorge gown grab grace grade grain grand grant grape graph grasp
grass grave gravy gray graze great greed green greet grew grid grief grill grim grin
grind grip grit groan groom groove gross group grove grow growl grown grunt guard guess
guest guide guilt guitar gulf gull gum gun gust gut guy gym habit hail hair half hall
halt ham hammer hand handle hang happy harbor hard hare harm harp harsh harvest has
haste hat hatch hate haul haunt have hawk hay hazard haze hazel head heal health heap
hear heard heart heat heaven heavy hedge heel height held helm help hem hen her herb
herd here hero hers hi hide high hike hill hilt him hint hip hire his hiss hit hive
hoax hobby hockey hoe hog hold hole hollow holy home honest honey honor hood hoof hook
hoop hop hope horn horse hose host hot hotel hound hour house hover how howl hub hue
huge hug hull hum human humble humor hundred hunger hunt hurl hurry hurt hush hut ice
icon icy idea ideal idle idol if ill image imply import impose in inch include income
indeed index indoor infant inform inhale ink inland inn inner input insect inside insist
inspect instant instead insult intact intend into invade invent invest invite iron irony
is island issue it item itself ivory ivy jab jacket jade jail jam jar jaw jazz jeans
jelly jerk jest jet jewel job jog join joint joke jolly jolt journal journey joy judge
jug juice July jumble jump June jungle junior junk jury just keen keep kept kettle key
kick kid kill kin kind king kiss kit kitchen kite kitten knee kneel knew knife knight
knit knob knock knot know known label labor lace lack lad ladder lady lag lake lamb
lame lamp land lane language lap lapse large lark last late later laugh launch laundry
lava law lawn lay layer lazy lead leaf league leak lean leap learn lease least leather
leave led ledge left leg legal legend lemon lend length lens lent leopard less lesson
let letter level lever liar liberty library lice lick lid lie life lift light like lily
limb lime limit limp line linen link lint lion lip liquid list listen lit little live
liver lizard load loaf loan lobby local lock lodge loft log logic lone long look loom
loop loose lord lose loss lost lot loud lounge love low loyal luck lucky lumber lump
lunar lunch lung lure lurk lush luxury lying lyric machine mad made magic magnet maid
mail main maize major make male mall malt man manage mane mango mansion many map maple
marble march mare margin marine mark market marry marsh mask mason mass mast master mat
match mate math matter maze meadow meal mean meant measure meat medal media medium meet
melody melon melt member memory men mend mental menu mercy mere merge merit merry mesh
mess message metal meter method middle midst might mild mile milk mill mind mine mineral
mint minus minute mirror mist mix moat mob mock mode model modern modest moist mold mole
moment money monkey month mood moon moral more morning most motel moth mother motion
motor mound mount mouse mouth move movie mow much mud mug mule multiply muscle museum
music must mute mutter my myself mystery nail name nap napkin narrow nasty nation native
nature naval navy near neat neck need needle negative neighbor neither nephew nerve nest
net never new news next nice nickel niece night nine noble nod noise none noon nor
normal north nose not note nothing notice noun novel now nudge number nurse nut oak oar
oat oath obey object oblige oboe observe obtain occur ocean odd odor of off offer office
often oil old olive omit on once one onion only onto open opera opinion oppose option or
oral orange orbit orchard order ore organ origin other ought ounce our out outer outfit
outline output oval oven over owe owl own ox oxygen oyster pace pack pad page paid pail
pain paint pair palace pale palm pan panel panic pant paper parade parcel pardon parent
park parrot part party pass past paste pat patch path patient patrol pattern pause pave
paw pay peace peach peak peanut pear pearl peck peel peer pen pencil penny people pepper
per perch perfect perform perhaps peril period permit person pest pet petal phase phone
photo phrase piano pick picnic picture pie piece pier pig pigeon pile pill pillow pilot
pin pinch pine pink pint pioneer pipe pistol pit pitch pity place plague plain plan
plane planet plank plant plaster plastic plate play plea plead please pledge plenty plot
plow plug plum plumb plume plunge plus pocket poem poet point poison pole police policy
polish polite pond pony pool poor pop popular porch pork port portion pose position
possible post pot potato pouch pound pour powder power praise pray preach precise
prefer prepare present press pretty prevent price pride prime prince print prison prize
probe problem produce profit program project promise proof proper protect proud prove
provide prune public pull pulp pulse pump punch pupil puppy pure purple purpose purse
push put puzzle pyramid quaint quake quality quarrel quart quarter queen query quest
question queue quick quiet quilt quit quite quiz quote rabbit race rack radar radio
radish raft rag rage raid rail rain raise rake rally ramp ran ranch random range rank
rapid rare rash rat rate rather ratio rattle raw ray razor reach react read ready real
realm reap rear reason rebel recall recent recipe record recover red reduce reed reef
reel refer reflect reform refuse regard region regret reign rein reject rejoice relate
relax relay release relief rely remain remark remedy remind remote remove rent repair
repeat replace reply report request rescue reserve resign resist resort respect rest
result retail retain retire retreat return reveal revenge review reward rhyme rhythm
rib ribbon rice rich rid ride ridge rifle right rigid rim ring rinse riot rip ripe rise
risk rival river road roam roar roast rob robe robin robot rock rocket rod rode rogue
role roll roof room roost root rope rose rot rough round route row royal rub rubber
rude rug ruin rule ruler rum rumor run rung runner rural rush rust rye sack sacred sad
saddle safe safety sag said sail sailor saint salad sale salmon salon salt salute same
sample sand sane sang sank sap sash sat satin sauce save saw say scale scan scar scarce
scare scarf scene scent school science scissors scold scoop scope score scorn scout
scrap scrape scratch scream screen screw scrub sea seal seam search season seat second
secret section secure see seed seek seem seen seize seldom select self sell send sense
sent sentence separate serial series serious serve service session set settle seven
several severe sew shade shadow shaft shake shall shallow shame shape share shark sharp
shave shed sheep sheer sheet shelf shell shelter shield shift shine ship shirt shiver
shock shoe shone shook shoot shop shore short shot should shoulder shout shove shovel
show shower shrank shred shrimp shrine shrink shrub shrug shut shy sick side siege sigh
sight sign signal silence silk sill silly silver similar simple since sincere sing
single sink sip sir siren sister sit site six size skate sketch ski skill skin skip
skirt skull sky slab slam slang slant slap slate slave sled sleep sleeve slender slept
slice slide slight slim slip slit slope slot slow slug slum small smart smash smell
smile smoke smooth snack snail snake snap snarl sneak sniff snow snug so soak soap soar
sob social sock soda sofa soft soil solar sold soldier sole solid solve some son song
soon soothe sore sorrow sorry sort soul sound soup sour source south sow space spade
span spare spark speak spear special speck speech speed spell spend spent sphere spice
spider spike spill spin spine spiral spirit spit splash split spoil spoke sponge spool
spoon sport spot spout spray spread spring sprint spruce spun spur spy square squeeze
squirrel stable stack staff stage stain stair stake stale stalk stall stamp stand star
stare start state station statue stay steady steak steal steam steel steep steer stem
step stern stick stiff still sting stir stitch stock stole stomach stone stood stool
stoop stop store storm story stout stove straight strain strand strange straw stray
stream street stress stretch strict stride strike string strip stripe stroke strong
struck stub stuck student study stuff stump stun stunt style subject submit subtle
succeed such suck sudden suffer sugar suggest suit sulfur sum summer summit sun sunk
sunny super supper supply support suppose sure surf surface surge surprise survey
suspect swallow swam swamp swan swap swarm sway swear sweat sweep sweet swell swept
swift swim swing switch sword swore swung symbol syrup system table tack tackle tact
tag tail tailor take tale talent talk tall tame tan tangle tank tap tape target task
taste taught tax tea teach team tear tease teeth tell temper temple tempt ten tenant
tend tender tennis tense tent term terrace terror test text than thank that thaw the
theft their them theme then theory there these they thick thief thin thing think third
thirst thirty this thorn those though thought thread threat three threw thrill throat
throne through throw thrust thumb thunder thus tick ticket tide tidy tie tiger tight
tile till tilt timber time timid tin tiny tip tire tired tissue title toad toast today
toe together toil told toll tomato tomb tone tongue tonight too took tool tooth top
topic torch torn toss total touch tough tour toward towel tower town toy trace track
trade traffic trail train trait tramp trap trash travel tray tread treat tree trek
tremble trench trend trial tribe trick tried trim trip triple troop trophy trot trouble
trout truck true trumpet trunk trust truth try tub tube tuck tug tulip tumble tune
tunnel turf turkey turn turtle tusk tutor twelve twenty twice twig twin twist two type
ugly umbrella uncle under undo unfair unfold union unit unite unless unlike until
unusual up upon upper upset urban urge urgent us use used useful usher usual utter
vacant vague vain valley value valve van vane vanish vapor variety various vase vast
vault veal veer vein velvet vendor venture verb verse very vessel vest veto vex via
vibrate vice victim victory video view vigor village vine vinegar violet violin virtue
visible vision visit vital vivid vocal voice void volcano volume vote vow vowel voyage
wade wag wage wagon waist wait wake walk wall walnut wander want war ward warm warn
warp wart wary was wash wasp waste watch water wave wax way we weak wealth weapon wear
weary weather weave web wed wedge week weep weigh weight weird welcome weld well went
were west wet whale wharf what wheat wheel when where which while whim whip whirl
whisper whistle white who whole whom whose why wick wicked wide widow width wife wig
wild will willow win wind window wine wing wink winter wipe wire wise wish wit witch
with within without witness wizard wolf woman women won wonder wood wool word wore
work world worm worn worry worse worship worst worth would wound wove wrap wrath wreck
wren wrench wrist write wrong wrote yacht yard yarn yawn year yeast yell yellow yes
yesterday yet yield yoke yolk you young your youth zeal zebra zero zest zinc zone zoo
`;

export const WORDS = new Set(RAW.trim().split(/\s+/));

/** Good tray seeds: long words with lots of hidden shorter words inside. */
export const SEEDS = [
  'anchors', 'baskets', 'blanket', 'brakes', 'cabinet', 'candles', 'captain',
  'carpets', 'cartoon', 'castles', 'cheated', 'clothes', 'compare', 'counter',
  'crayons', 'diamond', 'dolphin', 'dragons', 'drapes', 'earning', 'eastern',
  'elastic', 'farmers', 'feature', 'flowers', 'forests', 'gardens', 'general',
  'granite', 'hamster', 'harvest', 'hunters', 'islands', 'jackets', 'kitchen',
  'lantern', 'leaders', 'markets', 'meaning', 'mermaid', 'monster', 'notices',
  'orchard', 'painter', 'pancake', 'parents', 'pattern', 'picture', 'planets',
  'pockets', 'printer', 'rainbow', 'reading', 'rockets', 'sandwich', 'scatter',
  'seaside', 'shelter', 'silence', 'sockets', 'stables', 'station', 'stormed',
  'streams', 'teacher', 'thunder', 'tickets', 'toaster', 'trainer', 'weather',
  'western', 'windows', 'wonders',
];

const remote = new Map();   // word -> boolean, so we only ask once

/** true / false / 'unknown' if we couldn't reach the dictionary. */
export async function isWord(w) {
  w = w.toLowerCase();
  if (WORDS.has(w)) return true;
  if (remote.has(w)) return remote.get(w);
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`,
      { signal: AbortSignal.timeout(3500) });
    const ok = res.ok;
    remote.set(w, ok);
    return ok;
  } catch {
    return 'unknown';
  }
}
