import { profileChips } from "../config/playProfile";

/** Read-only chips. Renders nothing when the profile is empty. */
export default function PlayProfileChips({ profile, testId = "play-profile-chips" }) {
  const chips = profileChips(profile);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {chips.map((c) => (
        <span
          key={c}
          className="px-2 py-0.5 text-xs font-medium"
          style={{ background: "#F1F1F1", color: "#374151" }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
