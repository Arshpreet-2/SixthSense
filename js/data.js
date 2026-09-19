/* SixthSense — mock data, app state and constants */
"use strict";

/* ---------------- data ---------------- */
const DATA = {
  news:[
    {tag:"Alert nearby", tone:"mod", t:"Streetlight out near Lothian Road",
     b:"Reported 40 min ago by a verified member. Waiting for a second confirmation.", where:"About 600 m from you · sample"},
    {tag:"Alert nearby", tone:"mod", t:"Dogs reported on the Civil Lines approach",
     b:"Two members heard a pack near the crossing after 10 pm this week.", where:"About 1.2 km from you · sample"},
    {tag:"Fixed nearby", tone:"safe", t:"Gate 2 light working again",
     b:"Confirmed by two Circle members this evening.", where:"About 300 m from you · sample"},
    {tag:"Alert nearby", tone:"mod", t:"Lift out at Kashmere Gate metro, gate 1",
     b:"Use gate 3, which is staffed and lit.", where:"About 900 m from you · sample"},
    {tag:"Busy tonight", tone:"safe", t:"Market open late on Nicholson Road",
     b:"Shops and autos about until around 11 pm.", where:"About 700 m from you · sample"}
  ],
  help:{
    "Emergency help":[{n:"Police Stations and Hospitals",m:"Nearest first, from OpenStreetMap",go:"explore"},{n:"Emergency numbers",m:"112 all emergencies · 1091 women helpline · 181 women helpline (Delhi)"},{n:"SOS",m:"Hold the button to alert your guardians",go:"sos"}],
    "Women safety resources":[{n:"Women Help & Support Centres",m:"Delhi Commission for Women"},{n:"Legal Assistance",m:"Free legal aid cells"},{n:"Crisis & Counselling Support",m:"24×7 helplines"},{n:"Government Safety Schemes",m:"Himmat Plus, Safe City"}],
    "Nearby support":[{n:"Metro and bus",m:"Staffed stations nearby",go:"explore"},{n:"Ask Angels",m:"Live information from verified women",go:"askangels"},{n:"Need an Angel",m:"Someone nearby stays with you",go:"needangel"}]
  },
  posts:[
    {a:"Ritika",t:"2 h ago",b:"The lane behind the metro gets very quiet after 9 PM. Take the main road instead; it adds four minutes but shops stay open the whole way.",l:24,r:[{a:"Priya",b:"Agreed, I always take the main road now."}]},
    {a:"Ananya",t:"5 h ago",b:"Streetlights near Lothian Road have been out for three days. Reported it through an audit as well.",l:41,r:[]},
    {a:"Meera",t:"Yesterday",b:"The auto stand at ISBT has been reliable late at night; drivers use the meter.",l:17,r:[{a:"Sneha",b:"Good to know, thanks!"}]}
  ],
  chats:{
    Priya:[{f:"them",b:"Hi! Are you near the metro right now?"},{f:"them",b:"Gate 3 is pretty quiet tonight, gate 5 has more people."}],
    Ananya:[{f:"them",b:"Is the road past the market okay at this hour?"}],
    Ritika:[{f:"them",b:"Posted about the streetlights — has anyone seen them fixed?"}],
    Sneha:[{f:"them",b:"Walking back from the office, all good on the main road."}]
  }
};

/* ---------------- state ---------------- */
const S = {
  screen:"welcome", stack:[], tab:"home",
  user:{style:null, avatar:null, name:"", gender:"", phone:"", email:"", verified:false},
  contacts:[{n:"",p:""},{n:"",p:""},{n:"",p:""}],   // hers, added by her; never seeded for a real account
  perms:{location:false,audio:false,sms:false,camera:false},
  guardians:{voice:false,camera:false,sms:true,active:false,shareTrips:true},
  share:{active:false,with:[]},
  travel:{mode:"any",from:"Current Location",to:"",fromPlace:null,toPlace:null,at:"",search:null,loading:false,result:null,sel:null,
    compare:false,open:{},active:null,err:null,lastTripAt:null,sugg:{},when:"now",date:"",prefs:["balanced"], tell:null,
    },
  recent:[], trips:[],
  v:{step:0,method:null,email:"",code:"",linkSent:false,idImg:null,instr:"",checking:false,err:null},
  ang:{available:false, sortBy:"near", pick:null, angels:[], requests:[], session:null, sessionId:null, asking:false, meet:"", place:"",placeObj:null,when:"Now",list:null,qid:null,sid:null,wid:null,circle:null,draft:"",taps:{},note:"",stars:0,tags:[],rated:false},
  sos:{sent:false,opened:false,photos:0,photoErr:null},
  chat:{open:false, busy:false, msgs:[]}, lang:"en", areaLoading:false, areaErr:null, styleDraft:null, styleInfo:null, shareReadings:true, lastReportStatus:null, staySignedIn:true, hereName:null,
  audit:{}, audits:[],
  points:0, logged:0,
  alerts:[
    {t:"Sample alert",m:"Streetlight outage reported near Lothian Road, 40 min ago (pending confirmation).",w:"40 min ago",unread:true},
    {t:"Community",m:"Ritika replied to your post about the metro lane.",w:"2 h ago",unread:true},
    {t:"Audit",m:"Your audit of Barakhamba Road earned 10 safety points.",w:"Yesterday",unread:false}
  ],
  heat:true, lightLayer:false, mapTapped:false, connectShare:null, chatWith:null, cat:null,
  draftPost:"", reacted:{}, openReplies:null, drawer:false
};
const SCALE={1:"Very Unsafe",2:"Uncomfortable",3:"Neutral",4:"Safe",5:"Very Safe"};
const LIGHTS={1:"Very poorly lit",2:"Poorly lit",3:"Adequate",4:"Well lit",5:"Very well lit"};
const freshAudit = () => ({light:0,crowd:"",gender:"",cctv:"",shops:"",path:"",tags:[],dogs:"",gut:0,remark:"",remarks:"",photo:null,reading:null,filled:{},busy:false,sensorAgrees:false});
S.audit = freshAudit();

/* help points for the pilot area when the live download is not ready */
let HELP_FALLBACK = [];
fetch("data/helppoints.igdtuw.json").then(r=>r.json()).then(j=>{ HELP_FALLBACK = j.points; }).catch(()=>{});
let ZONES = [];
fetch("data/deadzones.mock.json").then(r=>r.json()).then(j=>{ ZONES = j.zones; Agent.setZones(ZONES); }).catch(()=>{});
