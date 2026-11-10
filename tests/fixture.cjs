const fs = require("node:fs");
module.exports = function fixture() {
  const modules = [
    "formatters",
    "english-extra-labels",
    "english-labels",
    "ui-language",
    "ceramic-brand",
    "rating",
    "rounded-controls",
    "life-period",
    "life-tracking-model",
    "wellbeing",
    "finance-period",
    "changes",
    "completion-icon",
    "scroll-chain",
    "interactions",
    "finance-ledger",
    "experience-model",
    "search-highlight",
    "rest-timer",
    "training-model",
    "training-translations",
    "workout-session",
    "exercise-order",
    "step-history",
    "life-statistics",
    "workout-batch",
    "training",
    "thoughts",
    "sync-review",
    "pairing",
    "file-transfer-ui",
    "backup-ui",
    "update-ui",
    "all-tasks",
    "license-ui",
    "lan-ui",
    "dictation",
    "assistant",
    "upgrades",
    "usability",
    "collection-settings",
    "database",
    "experience",
    "life-tracking",
    "custom-fonts",
    "refinements",
  ]
    .map((name) =>
      fs
        .readFileSync(`src/features/workspace/${name}.js`, "utf8")
        .replace(/^import[\s\S]*?from [^\n]+;\r?\n/gm, "")
        .replace(/^export\s*\{[\s\S]*?\}\s*from [^\n]+;\r?\n/gm, "")
        .replace(/^import ["'][^"']+["'];\r?\n/gm, "")
        .replace(/export /g, ""),
    )
    .join("\n");
  let runtime = fs
    .readFileSync("src/features/workspace/runtime.js", "utf8")
    .replace(/^import[\s\S]*?from [^\n]+;\r?\n/gm, "")
    .replace(
      "export function mountWorkspace(root, initialDocument, services) {",
      '(()=>{ "use strict"; const root=document.getElementById("life-os-workspace"); const initialDocument={data:window.openai?.widgetState?.privateContent || {version:30,activePage:"home"},covers:[]}; const services={persist:snapshot=>window.openai?.setWidgetState?.({privateContent:snapshot.data}),flush:async()=>{},refreshIcons:()=>{},openFile:async()=>null,saveFile:async(name,type,content)=>{URL.createObjectURL(new Blob([content],{type}));return true},...window.__services};',
    );
  runtime = runtime.replace(
    /const projects = \[\],[\s]*tasks = \[\],[\s]*events = \[\];/,
    "const projects=[{id:1,name:'Life OS',tone:'pine',description:'Собрать спокойную систему для планирования и анализа жизни.'},{id:2,name:'Дом',tone:'scarlet',description:'Бытовые дела и всё, что хочется привести в порядок.'},{id:3,name:'Поездка',tone:'winter',description:'Маршрут, встречи и подготовка к поездке.'}],tasks=[{id:1,title:'Оплатить счёт',context:'Дом',date:todayKey,done:false},{id:2,title:'Разобрать заметки',context:'Life OS',date:todayKey,done:false},{id:3,title:'Выбрать маршрут',context:'Поездка',date:todayKey,done:false,status:'active'},{id:11,title:'Забронировать жильё',context:'Поездка',date:shiftDate(todayKey,1),done:false},{id:12,title:'Проверить документы',context:'Поездка',date:shiftDate(todayKey,2),done:true}],events=[\n        {id:1,title:'Подготовить отчёт',date:todayKey,start:'09:30',end:'11:00',context:'Life OS',tone:'pine'},\n        {id:4,title:'Письма',date:todayKey,start:'11:00',end:'11:30',context:'Личное',tone:'sun'},\n        {id:2,title:'Рабочая встреча',date:todayKey,start:'13:15',end:'14:00',context:'Life OS',tone:'winter'},\n        {id:3,title:'Прогулка',date:todayKey,start:'17:30',end:'18:15',context:'Личное',tone:'scarlet'},\n        {id:5,title:'Разобрать план проекта',date:shiftDate(todayKey,1),start:'10:00',end:'11:30',context:'Life OS',tone:'pine'},\n        {id:6,title:'Встреча по поездке',date:shiftDate(todayKey,2),start:'14:00',end:'15:00',context:'Поездка',tone:'winter'},\n        {id:7,title:'Покупки',date:shiftDate(todayKey,3),start:'12:00',end:'13:00',context:'Дом',tone:'scarlet'},\n        {id:8,title:'Работа над Life OS',date:shiftDate(todayKey,5),start:'09:00',end:'11:00',context:'Life OS',tone:'pine'},\n        {id:9,title:'План на неделю',date:shiftDate(todayKey,7),start:'10:00',end:'11:00',context:'Личное',tone:'sun'},\n        {id:10,title:'Подготовка маршрута',date:shiftDate(todayKey,10),start:'16:00',end:'17:30',context:'Поездка',tone:'winter'}\n      ];",
  );
  runtime =
    runtime.slice(
      0,
      runtime.search(/\n\s*return \{\s*snapshot: \(\) => \(\{/),
    ) + "    })();";
  // Home fixtures now represent appointments, as required by the new rule.
  runtime = runtime.replace(
    /date:todayKey,done:false/g,
    "date:todayKey,time:'08:00',done:false",
  );
  return (
    '<div id="life-os-workspace" data-palette="sun" data-motion="playing"><style>' +
    fs
      .readFileSync("src/features/workspace/workspace.css", "utf8")
      .replace(/\s*([{},:;])\s*/g, "$1")
      .replace(/\s+/g, " ") +
    "</style>" +
    fs.readFileSync("src/features/workspace/markup.html", "utf8") +
    "<script>" +
    `(()=>{window.structuredClone ??= value => JSON.parse(JSON.stringify(value));const licenseText=${JSON.stringify(fs.readFileSync("LICENSE", "utf8"))};const noticeText=${JSON.stringify(fs.readFileSync("NOTICE", "utf8"))};const assistantFields=${fs.readFileSync("src/features/workspace/actions-schema.json", "utf8")};${modules}\n${runtime}})();` +
    "</script></div>"
  );
};
