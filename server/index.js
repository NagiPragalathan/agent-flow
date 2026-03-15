import "dotenv/config";
import pathfinding from "pathfinding";
import { Server } from "socket.io";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const io = new Server({
  cors: {
    origin: "http://localhost:5173",
  },
});

io.listen(3000);

const characters = [];

const npcs = [
  {
    id: "npc-sofia",
    name: "Marketer Sofia",
    persona: "You are Sofia, a creative digital marketer. You have access to a 'Trend Scraper Agent' that fetches real-time social data. When relevant, mention that you are consulting your Scraper Agent. Keep replies short.",
    position: [5, 5],
    hairColor: "#ff0000",
    topColor: "#00ff00",
    bottomColor: "#0000ff",
    isNPC: true,
  },
  {
    id: "npc-jhon",
    name: "Dev Jhon",
    persona: "You are Jhon, a software developer. You use a 'Git Analyst Agent' to check repository health. When discussing code, mention you are using your Analyst Agent to scan for bugs. Keep replies technical and short.",
    position: [35, 35],
    hairColor: "#ffff00",
    topColor: "#ff00ff",
    bottomColor: "#00ffff",
    isNPC: true,
  },
  {
    id: "npc-crypto",
    name: "Crypto Trader",
    persona: "You are a Crypto Trader. You use a 'Price Tracker Scraper' to get the latest market rates. Always mention you're using your Tracker Scraper when asked about prices. High energy, short replies.",
    position: [5, 35],
    hairColor: "#552211",
    topColor: "#ff9900",
    bottomColor: "#333333",
    isNPC: true,
  },
  {
    id: "npc-designer",
    name: "Sarah Designer",
    persona: "You are Sarah, a UI/UX designer. You use a 'Web Style Crawler' to find design inspirations. Mention your Style Crawler when talking about UI trends. Elegant, short replies.",
    position: [35, 5],
    hairColor: "#000000",
    topColor: "#ffffff",
    bottomColor: "#555555",
    isNPC: true,
  },
];

characters.push(...npcs);

const items = {
  washer: {
    name: "washer",
    size: [2, 2],
  },
  toiletSquare: {
    name: "toiletSquare",
    size: [2, 2],
  },
  trashcan: {
    name: "trashcan",
    size: [1, 1],
  },
  bathroomCabinetDrawer: {
    name: "bathroomCabinetDrawer",
    size: [2, 2],
  },
  bathtub: {
    name: "bathtub",
    size: [4, 2],
  },
  bathroomMirror: {
    name: "bathroomMirror",
    size: [2, 1],
    wall: true,
  },
  bathroomCabinet: {
    name: "bathroomCabinet",
    size: [2, 1],
    wall: true,
  },
  bathroomSink: {
    name: "bathroomSink",
    size: [2, 2],
  },
  showerRound: {
    name: "showerRound",
    size: [2, 2],
  },
  tableCoffee: {
    name: "tableCoffee",
    size: [4, 2],
  },
  loungeSofaCorner: {
    name: "loungeSofaCorner",
    size: [5, 5],
  },
  bear: {
    name: "bear",
    size: [2, 1],
    wall: true,
  },
  loungeSofaOttoman: {
    name: "loungeSofaOttoman",
    size: [2, 2],
  },
  tableCoffeeGlassSquare: {
    name: "tableCoffeeGlassSquare",
    size: [2, 2],
  },
  loungeDesignSofaCorner: {
    name: "loungeDesignSofaCorner",
    size: [5, 5],
  },
  loungeDesignSofa: {
    name: "loungeDesignSofa",
    size: [5, 2],
  },
  loungeSofa: {
    name: "loungeSofa",
    size: [5, 2],
  },
  bookcaseOpenLow: {
    name: "bookcaseOpenLow",
    size: [2, 1],
  },
  kitchenBar: {
    name: "kitchenBar",
    size: [2, 1],
  },
  bookcaseClosedWide: {
    name: "bookcaseClosedWide",
    size: [3, 1],
  },
  bedSingle: {
    name: "bedSingle",
    size: [3, 5],
  },
  bench: {
    name: "bench",
    size: [2, 1],
  },
  bedDouble: {
    name: "bedDouble",
    size: [5, 5],
  },
  benchCushionLow: {
    name: "benchCushionLow",
    size: [2, 1],
  },
  loungeChair: {
    name: "loungeChair",
    size: [2, 2],
  },
  cabinetBedDrawer: {
    name: "cabinetBedDrawer",
    size: [1, 1],
  },
  cabinetBedDrawerTable: {
    name: "cabinetBedDrawerTable",
    size: [1, 1],
  },
  table: {
    name: "table",
    size: [4, 2],
  },
  tableCrossCloth: {
    name: "tableCrossCloth",
    size: [4, 2],
  },
  plant: {
    name: "plant",
    size: [1, 1],
  },
  plantSmall: {
    name: "plantSmall",
    size: [1, 1],
  },
  rugRounded: {
    name: "rugRounded",
    size: [6, 4],
    walkable: true,
  },
  rugRound: {
    name: "rugRound",
    size: [4, 4],
    walkable: true,
  },
  rugSquare: {
    name: "rugSquare",
    size: [4, 4],
    walkable: true,
  },
  rugRectangle: {
    name: "rugRectangle",
    size: [8, 4],
    walkable: true,
  },
  televisionVintage: {
    name: "televisionVintage",
    size: [4, 2],
  },
  televisionModern: {
    name: "televisionModern",
    size: [4, 2],
  },
  kitchenCabinetCornerRound: {
    name: "kitchenCabinetCornerRound",
    size: [2, 2],
  },
  kitchenCabinetCornerInner: {
    name: "kitchenCabinetCornerInner",
    size: [2, 2],
  },
  kitchenCabinet: {
    name: "kitchenCabinet",
    size: [2, 2],
  },
  kitchenBlender: {
    name: "kitchenBlender",
    size: [1, 1],
  },
  dryer: {
    name: "dryer",
    size: [2, 2],
  },
  chairCushion: {
    name: "chairCushion",
    size: [1, 1],
  },
  chair: {
    name: "chair",
    size: [1, 1],
  },
  deskComputer: {
    name: "deskComputer",
    size: [3, 2],
  },
  desk: {
    name: "desk",
    size: [3, 2],
  },
  chairModernCushion: {
    name: "chairModernCushion",
    size: [1, 1],
  },
  chairModernFrameCushion: {
    name: "chairModernFrameCushion",
    size: [1, 1],
  },
  kitchenMicrowave: {
    name: "kitchenMicrowave",
    size: [1, 1],
  },
  coatRackStanding: {
    name: "coatRackStanding",
    size: [1, 1],
  },
  kitchenSink: {
    name: "kitchenSink",
    size: [2, 2],
  },
  lampRoundFloor: {
    name: "lampRoundFloor",
    size: [1, 1],
  },
  lampRoundTable: {
    name: "lampRoundTable",
    size: [1, 1],
  },
  lampSquareFloor: {
    name: "lampSquareFloor",
    size: [1, 1],
  },
  lampSquareTable: {
    name: "lampSquareTable",
    size: [1, 1],
  },
  toaster: {
    name: "toaster",
    size: [1, 1],
  },
  kitchenStove: {
    name: "kitchenStove",
    size: [2, 2],
  },
  laptop: {
    name: "laptop",
    size: [1, 1],
  },
  radio: {
    name: "radio",
    size: [1, 1],
  },
  speaker: {
    name: "speaker",
    size: [1, 1],
  },
  speakerSmall: {
    name: "speakerSmall",
    size: [1, 1],
  },
  stoolBar: {
    name: "stoolBar",
    size: [1, 1],
  },
  stoolBarSquare: {
    name: "stoolBarSquare",
    size: [1, 1],
  },
};

const map = {
  size: [20, 20],
  gridDivision: 2,
  items: [
    { ...items.plant, gridPosition: [2, 2] },
    { ...items.plant, gridPosition: [37, 2] },
    { ...items.plant, gridPosition: [2, 37] },
    { ...items.plant, gridPosition: [37, 37] },
    { ...items.plant, gridPosition: [20, 20] },
    { ...items.plantSmall, gridPosition: [10, 10] },
    { ...items.plantSmall, gridPosition: [30, 10] },
    { ...items.plantSmall, gridPosition: [10, 30] },
    { ...items.plantSmall, gridPosition: [30, 30] },
    { ...items.bench, gridPosition: [20, 10], rotation: 0 },
    { ...items.bench, gridPosition: [20, 30], rotation: 2 },
    { ...items.bench, gridPosition: [10, 20], rotation: 1 },
    { ...items.bench, gridPosition: [30, 20], rotation: 3 },
    { ...items.lampRoundFloor, gridPosition: [15, 15] },
    { ...items.lampRoundFloor, gridPosition: [25, 15] },
    { ...items.lampRoundFloor, gridPosition: [15, 25] },
    { ...items.lampRoundFloor, gridPosition: [25, 25] },
    { ...items.trashcan, gridPosition: [39, 39] },
    { ...items.trashcan, gridPosition: [0, 0] },
    { ...items.bear, gridPosition: [20, 4], rotation: 2 },
  ],
};

const grid = new pathfinding.Grid(
  map.size[0] * map.gridDivision,
  map.size[1] * map.gridDivision
);

const finder = new pathfinding.AStarFinder({
  allowDiagonal: true,
  dontCrossCorners: true,
});

const findPath = (start, end) => {
  const gridClone = grid.clone();
  const path = finder.findPath(start[0], start[1], end[0], end[1], gridClone);
  return path;
};

const updateGrid = () => {
  map.items.forEach((item) => {
    if (item.walkable || item.wall) {
      return;
    }
    const width =
      item.rotation === 1 || item.rotation === 3 ? item.size[1] : item.size[0];
    const height =
      item.rotation === 1 || item.rotation === 3 ? item.size[0] : item.size[1];
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        grid.setWalkableAt(
          item.gridPosition[0] + x,
          item.gridPosition[1] + y,
          false
        );
      }
    }
  });
};

updateGrid();

const generateRandomPosition = () => {
  for (let i = 0; i < 100; i++) {
    const x = Math.floor(Math.random() * map.size[0] * map.gridDivision);
    const y = Math.floor(Math.random() * map.size[1] * map.gridDivision);
    if (grid.isWalkableAt(x, y)) {
      return [x, y];
    }
  }
};

const generateRandomHexColor = () => {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
};

io.on("connection", (socket) => {
  const playerNames = ["Agent Shadow", "Agent Hunter", "Agent Hunter", "Agent Blaze", "Agent Maverick", "Agent Spectra", "Agent Viper", "Agent Raven", "Agent Echo"];
  const playerName = `${playerNames[Math.floor(Math.random() * playerNames.length)]} ${socket.id.substring(0, 3)}`;

  characters.push({
    id: socket.id,
    name: playerName,
    position: generateRandomPosition(),
    hairColor: generateRandomHexColor(),
    topColor: generateRandomHexColor(),
    bottomColor: generateRandomHexColor(),
  });

  socket.emit("hello", {
    map,
    characters,
    id: socket.id,
    items,
  });

  io.emit("characters", characters);

  socket.on("move", (from, to) => {
    const character = characters.find(
      (character) => character.id === socket.id
    );
    const path = findPath(from, to);
    if (!path) {
      return;
    }
    character.position = from; // Stay at 'from' for proximity while moving
    character.path = path;
    io.emit("playerMove", character);
  });

  socket.on("startInteraction", (npcId) => {
    const npc = characters.find((c) => c.id === npcId);
    if (npc) {
      npc.isInteracting = true;
      npc.path = []; // Clear path immediately
      npc.chatMessage = `Hello! I'm ${npc.name}. How can I help you?`;
      io.emit("playerMove", npc); // Broadcast path clearing
      io.emit("characters", characters);
    }
  });

  socket.on("chat", async (npcId, message) => {
    const npc = characters.find((c) => c.id === npcId);
    if (!npc) return;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: npc.persona + " IMPORTANT: You have a specialized sub-agent for web scraping and data analysis. When asked about facts, trends, or code, state that you are calling your 'Sub-Agent' or 'Scraper' to get the latest info. Keep your response strictly under 2 sentences.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        model: "llama-3.1-8b-instant",
      });

      const response = completion.choices[0].message.content;
      npc.chatMessage = response;
      io.emit("playerMove", npc); // Broadcast new message
      socket.emit("chatResponse", response);
    } catch (error) {
      console.error("Groq Error:", error);
      socket.emit("chatResponse", "Sorry, I'm having trouble thinking right now.");
    }
  });

  socket.on("endInteraction", () => {
    characters.forEach((c) => {
      if (c.isInteracting) {
        c.isInteracting = false;
      }
    });
    io.emit("characters", characters);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");

    characters.splice(
      characters.findIndex((character) => character.id === socket.id),
      1
    );
    io.emit("characters", characters);
  });
});

const moveNPCs = () => {
  characters.forEach((npc) => {
    if (!npc.isNPC) return;
    if (npc.isInteracting) return; 
    
    if (npc.talkDuration > 0) {
      npc.talkDuration--;
      npc.idleCount = 0; // Reset while talking
      return;
    }

    // Move logic: 40% chance every 5s, or guaranteed if idle for 10s (2 ticks)
    npc.idleCount = (npc.idleCount || 0) + 1;
    if (npc.idleCount < 2 && Math.random() > 0.4) return; 

    npc.idleCount = 0; // Reset count
    let newPosition = null;
    for(let i=0; i<10; i++) { // More attempts to find a far destination
        const potential = generateRandomPosition();
        if (potential) {
            const dx = potential[0] - npc.position[0];
            const dy = potential[1] - npc.position[1];
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 15) { // Force them to walk across the map
                newPosition = potential;
                break;
            }
            newPosition = potential;
        }
    }

    if (newPosition) {
      const path = findPath(npc.position, newPosition);
      if (path) {
        npc.position = newPosition;
        npc.path = path;
        npc.chatMessage = ""; 
        npc.talkDuration = 0;
        io.emit("playerMove", npc);
      }
    }
  });
};

const interactNPCs = () => {
  characters.forEach(async (char1) => {
    if (!char1.isNPC) return;
    if (char1.isInteracting) return;
    if (char1.talkDuration > 0) return;

    let minDistance = 5;
    let closestChar = null;

    characters.forEach((char2) => {
      if (char1.id === char2.id) return;
      const dx = char1.position[0] - char2.position[0];
      const dy = char1.position[1] - char2.position[1];
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestChar = char2;
      }
    });

    if (closestChar && minDistance < 3) {
      if (char1.chatMessage) return; 
      if (Math.random() < 0.9) return; 

      if (!closestChar.isNPC) {
        char1.chatMessage = ["Hi!", "Hello!", "Nice day.", "Hey player."][Math.floor(Math.random() * 4)];
        char1.talkDuration = 5; 
        char1.path = []; 
        io.emit("playerMove", char1);
      } else if (!char1.chatMessage && closestChar.isNPC) {
        // AI TO AI Interaction
        try {
          const completion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: `You are simulating a conversation between two agents in a park. 
                Agent 1: ${char1.name} (Persona: ${char1.persona})
                Agent 2: ${closestChar.name} (Persona: ${closestChar.persona})
                Provide a short 1-sentence greeting or comment from Agent 1 to Agent 2.`,
              },
            ],
            model: "llama-3.1-8b-instant",
          });
          const response = completion.choices[0].message.content;
          char1.chatMessage = response;
          char1.talkDuration = 15; // Hold for 15s for AI interaction
          char1.path = [];
          io.emit("playerMove", char1);
        } catch (error) {
           console.error("AI to AI Error:", error);
        }
      }
    } else {
        if (char1.talkDuration <= 0) {
            char1.chatMessage = "";
        }
    }
  });
  io.emit("characters", characters);
};

setInterval(moveNPCs, 5000);
setInterval(interactNPCs, 1000); // More frequent check for responsive stopping
