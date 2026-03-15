import { Environment, Grid, OrbitControls, useCursor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useAtom } from "jotai";
import { useState } from "react";
import { useGrid } from "../hooks/useGrid";
import { AnimatedWoman } from "./AnimatedWoman";
import { Item } from "./Item";
import { charactersAtom, mapAtom, socket, userAtom, interactingNPCAtom } from "./SocketManager";

export const Experience = () => {
  const [characters] = useAtom(charactersAtom);
  const [map] = useAtom(mapAtom);
  const [onFloor, setOnFloor] = useState(false);
  const [interactingNPC] = useAtom(interactingNPCAtom);
  useCursor(onFloor);
  const { vector3ToGrid, gridToVector3 } = useGrid();

  const scene = useThree((state) => state.scene);
  const [user] = useAtom(userAtom);

  if (!map) return null;

  const onCharacterMove = (e) => {
    const character = scene.getObjectByName(`character-${user}`);
    if (!character) {
      return;
    }
    socket.emit(
      "move",
      vector3ToGrid(character.position),
      vector3ToGrid(e.point)
    );
  };

  return (
    <>
      <Environment preset="sunset" />
      <ambientLight intensity={0.3} />
      <OrbitControls enabled={!interactingNPC} />

      {map.items.map((item, idx) => (
        <Item key={`${item.name}-${idx}`} item={item} />
      ))}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={-0.01}
        onPointerDown={onCharacterMove}
        onPointerEnter={() => setOnFloor(true)}
        onPointerLeave={() => setOnFloor(false)}
        position-x={map.size[0] / 2}
        position-z={map.size[1] / 2}
      >
        <planeGeometry args={map.size} />
        <meshStandardMaterial color="#55aa55" />
      </mesh>
      <Grid infiniteGrid fadeDistance={50} fadeStrength={5} pointerEvents="none" />
      {characters.map((character) => (
        <AnimatedWoman
          key={character.id}
          id={character.id}
          name={character.name}
          path={character.path}
          position={gridToVector3(character.position)}
          hairColor={character.hairColor}
          topColor={character.topColor}
          bottomColor={character.bottomColor}
          chatMessage={character.chatMessage}
          isNPC={character.isNPC}
        />
      ))}
    </>
  );
};
