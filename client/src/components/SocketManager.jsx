import { atom, useAtom } from "jotai";
import { useEffect } from "react";
import { io } from "socket.io-client";

export const socket = io("http://localhost:3000");
export const charactersAtom = atom([]);
export const mapAtom = atom(null);
export const userAtom = atom(null);
export const interactingNPCAtom = atom(null);
export const targetNPCAtom = atom(null);

export const SocketManager = () => {
  const [_characters, setCharacters] = useAtom(charactersAtom);
  const [_map, setMap] = useAtom(mapAtom);
  const [_user, setUser] = useAtom(userAtom);
  const [interactingNPC] = useAtom(interactingNPCAtom);

  useEffect(() => {
    if (interactingNPC) {
      socket.emit("startInteraction", interactingNPC.id);
    } else {
      socket.emit("endInteraction");
    }
  }, [interactingNPC]);

  useEffect(() => {
    function onConnect() {
      console.log("connected");
    }
    function onDisconnect() {
      console.log("disconnected");
    }

    function onHello(value) {
      setMap(value.map);
      setUser(value.id);
      setCharacters(value.characters);
    }

    function onCharacters(value) {
      setCharacters((prev) => {
        return value.map((newChar) => {
          const prevChar = prev.find((c) => c.id === newChar.id);
          // If it's the current user, don't overwrite their path with server's stale/static path
          if (newChar.id === socket.id) {
            return {
              ...newChar,
              path: prevChar?.path || newChar.path,
            };
          }
          return newChar;
        });
      });
    }

    function onPlayerMove(value) {
      setCharacters((prev) => {
        return prev.map((character) => {
          if (character.id === value.id) {
            return value;
          }
          return character;
        });
      });
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("hello", onHello);
    socket.on("characters", onCharacters);
    socket.on("playerMove", onPlayerMove);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("hello", onHello);
      socket.off("characters", onCharacters);
      socket.off("playerMove", onPlayerMove);
    };
  }, []);
};
