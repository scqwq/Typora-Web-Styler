export const bookmarkStyle = `
:host { all: initial !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483647 !important; pointer-events: none !important; color-scheme: light; }
* { box-sizing: border-box; }
button, input { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: wait; opacity: .5; }
:focus-visible { outline: 3px solid #8aa99a; outline-offset: 2px; }
[hidden] { display: none !important; }
.surface { font: 14px/1.5 "Microsoft YaHei", system-ui, sans-serif; color: #283e35; pointer-events: auto; background: #fffef9; border: 1px solid #d7e2d5; box-shadow: 0 6px 24px #20342925; border-radius: 15px; }
.toolbar { position: fixed; transform: scale(.8); transform-origin: top left; padding: 3px; border-radius: 11px; font-size: 11px; }
.record { border: 0; border-radius: 7px; padding: 5px 10px; color: #fff; background: #34725b; }
.panel { position: fixed; width: min(300px, calc(100vw - 16px)); max-height: min(550px, calc(100vh - 16px)); display: flex; flex-direction: column; overflow: hidden; }
.head { display: flex; align-items: center; gap: 6px; padding: 10px; background: #eef4e9; border-bottom: 1px solid #dfe7d9; }
.handle { flex: 1; min-width: 0; cursor: move; touch-action: none; user-select: none; border: 0; padding: 3px; color: #34725b; text-align: left; background: transparent; font-weight: 600; }
.icon-button { border: 0; border-radius: 8px; padding: 4px 8px; color: #55745f; background: transparent; }
.icon-button:hover { background: #dfeadb; }
.list { padding: 8px; overflow-y: auto; overscroll-behavior: contain; }
.row { margin-bottom: 7px; padding: 8px; border: 1px solid #e5eadd; border-radius: 11px; background: #fff; }
.row:last-child { margin-bottom: 0; }
.summary { display: flex; align-items: center; gap: 8px; }
.jump { flex: 1; min-width: 0; border: 0; background: transparent; padding: 2px 0; display: flex; gap: 8px; text-align: left; align-items: center; color: inherit; }
.label { min-width: 0; overflow-wrap: anywhere; }
.dot { flex: 0 0 12px; width: 12px; height: 12px; border-radius: 4px; border: 1px solid #0002; }
.excerpt { margin: 5px 0 0 20px; color: #7b877c; font-size: 12px; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.missing .excerpt { color: #ad6036; }
.editor { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.name { width: 100%; padding: 7px; border: 1px solid #d4dfd1; border-radius: 7px; background: white; color: #283e35; }
.color { width: 38px; height: 30px; padding: 2px; border: 1px solid #d4dfd1; border-radius: 6px; background: white; }
.save, .cancel, .delete { border: 0; border-radius: 7px; padding: 5px 9px; background: #eaf2e5; color: #34725b; }
.delete { margin-left: auto; background: #fff0ec; color: #ad4c3c; }
.hint { padding: 8px 12px; border-top: 1px solid #e5eadd; color: #7b877c; font-size: 11px; }
.collapsed { width: auto; min-width: 128px; }
.collapsed .list, .collapsed .hint { display: none; }
.collapsed .head { border: 0; }
.marker { position: fixed; width: 26px; height: 28px; padding: 3px; border: 1px solid #ffffffc9; border-radius: 7px; background: #fff; box-shadow: 0 1px 6px #0003; pointer-events: auto; }
.marker svg { display: block; width: 18px; height: 20px; fill: currentColor; }
.flash { position: fixed; border: 2px solid; border-radius: 4px; pointer-events: none; background: #ffffff20; }
.toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); padding: 10px 15px; max-width: calc(100vw - 20px); width: max-content; pointer-events: none; }
`;
