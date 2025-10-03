import React, { useMemo, useState } from "react";
import {
  Music,
  CloudRain,
  Trees,
  CloudLightning,
  Wind,
  Search,
  Zap,
  Waves,
  Settings2,
  Flame,
  Skull,
  Swords,
  DoorOpen,
  Shield,
  Mountain,
  Castle,
  Ghost,
} from "lucide-react";

const ef = {
  bg: "#2B3339",
  bgSoft: "#323C41",
  card: "#374247",
  text: "#D3C6AA",
  textMuted: "#A6B0A0",
  primary: "#A7C080",
  accent: "#E6B450",
};

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-2xl border ${className}`}
    style={{ background: ef.card, border: `1px solid rgba(0,0,0,0.25)`, boxShadow: "0 4px 12px rgba(0,0,0,0.35)" }}
  >
    {children}
  </div>
);

const SceneChip = ({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors border"
    style={{
      color: active ? ef.bg : ef.text,
      background: active ? ef.primary : ef.bgSoft,
      borderColor: active ? ef.primary : "rgba(0,0,0,0.3)",
      boxShadow: active ? "0 2px 6px rgba(0,0,0,0.35)" : "none",
    }}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

const VerticalFader = ({ label, icon: Icon, value = 60 }: { label: string; icon: any; value?: number }) => (
  <div
    className="flex flex-col items-center gap-3 p-4 rounded-2xl"
    style={{ background: ef.card, border: `1px solid rgba(0,0,0,0.25)`, boxShadow: "0 6px 14px rgba(0,0,0,0.4)" }}
  >
    <div className="flex items-center gap-2 font-medium" style={{ color: ef.text }}>
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </div>
    <div className="relative h-56 w-12 flex items-center justify-center">
      <div className="absolute left-1/2 -translate-x-1/2 h-48 w-1.5 rounded" style={{ background: "rgba(255,255,255,0.12)" }} />
      <div
        className="absolute w-7 h-7 rounded-full"
        style={{
          top: `${(100 - value) * 0.48}%`,
          background: ef.primary,
          boxShadow: "0 6px 14px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.15)",
        }}
      />
      {[0, 25, 50, 75, 100].map((m) => (
        <div key={m} className="absolute -right-2 text-[10px]" style={{ top: `${(100 - m) * 0.48}%`, color: ef.textMuted }}>
          {m}
        </div>
      ))}
    </div>
  </div>
);

const LayerTile = ({
  label,
  icon: Icon,
  selected,
  onPick,
}: {
  label: string;
  icon: any;
  selected?: { name: string; thumb?: string } | null;
  onPick?: () => void;
}) => (
  <button
    onClick={onPick}
    className="flex items-center gap-3 p-3 rounded-xl w-full transition-colors"
    style={{
      background: ef.card,
      border: `1px solid rgba(0,0,0,0.25)`,
      color: ef.text,
      boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
    }}
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
      style={{ background: ef.bgSoft, border: `1px solid rgba(0,0,0,0.25)`, boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)" }}
    >
      {selected?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selected.thumb} alt={selected.name} className="w-full h-full object-cover" />
      ) : (
        <Icon className="w-5 h-5" />
      )}
    </div>
    <div className="flex-1 text-left">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs opacity-80" style={{ color: ef.textMuted }}>
        {selected ? selected.name : "No selection yet"}
      </div>
    </div>
    <div className="text-xs" style={{ color: ef.accent }}>Change</div>
  </button>
);

export default function EverforestMinimalUIShadowed() {
  const scenes = useMemo(
    () => [
      { id: "dungeon", label: "Dungeon • Drizzle • Tense", icon: Castle, oneshots: ["Door Slam", "Ghoul Hiss", "Stone Creak", "Echo Clap"] },
      { id: "jungle", label: "Jungle • Storm • Calm", icon: Trees, oneshots: ["Flock Burst", "Thunderclap", "Distant Roar", "Rain Splash"] },
      { id: "pass", label: "High Pass • Wind • Epic", icon: Mountain, oneshots: ["Avalanche Pebbles", "Wind Gust", "Eagle Cry", "War Horn"] },
    ],
    []
  );
  const [sceneId, setSceneId] = useState<string>(scenes[0].id);
  const scene = scenes.find((s) => s.id === sceneId)!;

  const [envSel, setEnvSel] = useState<{ name: string; thumb?: string } | null>(null);
  const [wxSel, setWxSel] = useState<{ name: string; thumb?: string } | null>(null);
  const [musSel, setMusSel] = useState<{ name: string; thumb?: string } | null>(null);

  return (
    <div className="min-h-screen w-full" style={{ background: `linear-gradient(180deg, ${ef.bg} 0%, #222827 100%)`, color: ef.text }}>
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <Section className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold" style={{ color: ef.text }}>Scenes</div>
            <div className="text-xs" style={{ color: ef.textMuted }}>Scene‑aware One‑shots</div>
          </div>
          <div className="flex flex-wrap gap-4">
            {scenes.map((s) => (
              <SceneChip key={s.id} icon={s.icon} label={s.label} active={s.id === sceneId} onClick={() => setSceneId(s.id)} />
            ))}
          </div>
        </Section>

        <section className="grid grid-cols-3 gap-4">
          <VerticalFader label="Environment" icon={Trees} value={70} />
          <VerticalFader label="Weather" icon={CloudRain} value={45} />
          <VerticalFader label="Music" icon={Music} value={60} />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <LayerTile label="Environment" icon={Trees} selected={envSel} onPick={() => setEnvSel({ name: "Dungeon – Stone Drip", thumb: "https://images.unsplash.com/photo-1558980664-10eaaff6e0a8?q=80&w=400&auto=format&fit=crop" })} />
          <LayerTile label="Weather" icon={CloudRain} selected={wxSel} onPick={() => setWxSel({ name: "Light Rain", thumb: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?q=80&w=400&auto=format&fit=crop" })} />
          <LayerTile label="Music" icon={Music} selected={musSel} onPick={() => setMusSel({ name: "Tense – Low Strings", thumb: "https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?q=80&w=400&auto=format&fit=crop" })} />
        </section>

        <Section className="p-3">
          <div className="font-semibold mb-2">One‑Shots</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {scene.oneshots.map((name) => {
              const map: Record<string, any> = {
                "Door Slam": DoorOpen,
                "Ghoul Hiss": Skull,
                "Stone Creak": Castle,
                "Echo Clap": Zap,
                "Flock Burst": Ghost,
                Thunderclap: CloudLightning,
                "Distant Roar": Flame,
                "Rain Splash": CloudRain,
                "Avalanche Pebbles": Mountain,
                "Wind Gust": Wind,
                "Eagle Cry": Ghost,
                "War Horn": Swords,
              };
              const Icon = map[name] || Shield;
              return (
                <button key={name} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: ef.card, border: "1px solid rgba(0,0,0,0.25)", color: ef.text, boxShadow: "0 3px 8px rgba(0,0,0,0.35)" }}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{name}</span>
                </button>
              );
            })}
          </div>
        </Section>
      </main>
    </div>
  );
}
