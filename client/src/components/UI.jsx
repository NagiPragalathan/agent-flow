import { useAtom } from "jotai";
import { useState } from "react";
import { interactingNPCAtom } from "./SocketManager";

export const UI = () => {
  const [interactingNPC, setInteractingNPC] = useAtom(interactingNPCAtom);
  const [isChatting, setIsChatting] = useState(false);
  const [chatValue, setChatValue] = useState("");

  if (!interactingNPC) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 9999,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {!isChatting ? (
        <div
          style={{
            pointerEvents: "auto",
            background: "rgba(10, 10, 15, 0.7)",
            backdropFilter: "blur(20px)",
            padding: "32px",
            borderRadius: "32px",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            display: "flex",
            gap: "20px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            transform: "scale(1.1)",
          }}
        >
          <button
            onClick={() => setIsChatting(true)}
            style={{
              padding: "16px 32px",
              borderRadius: "16px",
              border: "none",
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
              color: "white",
              fontWeight: "900",
              cursor: "pointer",
              fontSize: "18px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              boxShadow: "0 4px 15px rgba(168, 85, 247, 0.4)",
              transition: "transform 0.2s",
            }}
          >
            Start Convo
          </button>
          <button
            onClick={() => {
              setInteractingNPC(null);
              setIsChatting(false);
            }}
            style={{
              padding: "16px 32px",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "rgba(255, 255, 255, 0.05)",
              color: "rgba(255, 255, 255, 0.8)",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "18px",
              textTransform: "uppercase",
              transition: "all 0.2s",
            }}
          >
            Exit
          </button>
        </div>
      ) : (
        <div
          style={{
            pointerEvents: "auto",
            width: "500px",
            background: "rgba(15, 15, 20, 0.8)",
            backdropFilter: "blur(20px)",
            borderRadius: "24px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            style={{
              padding: "20px",
              background: "rgba(255, 255, 255, 0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ color: "#a855f7", fontWeight: "bold", fontSize: "18px" }}>
                Jana AI - Virtual Assistant
              </div>
              <div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "12px" }}>
                VIRTUAL ASSISTANT OF JANAKIRAMAN
              </div>
            </div>
            <button
              onClick={() => {
                setIsChatting(false);
                setInteractingNPC(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "20px",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ height: "300px", padding: "20px", overflowY: "auto" }}>
            {/* Messages would go here */}
            <div
              style={{
                color: "white",
                background: "rgba(168, 85, 247, 0.2)",
                padding: "12px",
                borderRadius: "12px",
                maxWidth: "80%",
                fontSize: "14px",
                lineHeight: "1.4",
              }}
            >
              Hello! I'm Jana AI. How can I help you today?
            </div>
          </div>
          <div
            style={{
              padding: "20px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              background: "rgba(0, 0, 0, 0.3)",
            }}
          >
            <input
              type="text"
              placeholder="TYPE A MESSAGE..."
              value={chatValue}
              onChange={(e) => setChatValue(e.target.value)}
              style={{
                flex: 1,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                padding: "14px 24px",
                borderRadius: "30px",
                color: "white",
                outline: "none",
                fontSize: "13px",
                letterSpacing: "1px",
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgba(236, 72, 153, 0.2)",
                  border: "none",
                  color: "#ec4899",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                🎙️
              </button>
              <button
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  border: "none",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {isChatting && (
        <div
          style={{
            position: "fixed",
            right: "40px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            pointerEvents: "auto",
          }}
        >
          {["🔍", "📷", "🔄"].map((icon, i) => (
            <button
              key={i}
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50% 12px 12px 50%",
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "rgba(255, 255, 255, 0.25)")}
              onMouseLeave={(e) => (e.target.style.background = "rgba(255, 255, 255, 0.15)")}
            >
              {icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
