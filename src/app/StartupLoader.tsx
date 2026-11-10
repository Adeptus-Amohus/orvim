import emblem from "../assets/branding/ceramic-windows.png";

export default function StartupLoader() {
  const english = navigator.language.toLowerCase().startsWith("en");
  return (
    <div
      className="startup"
      role="status"
      aria-label={english ? "Loading Orvim" : "Загрузка Orvim"}
    >
      <img
        className="startup-emblem"
        src={emblem}
        width="112"
        height="112"
        alt=""
      />
      <div className="startup-progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
