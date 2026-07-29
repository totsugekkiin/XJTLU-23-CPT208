function createHistoryContent(id, label, description, columns, article) {
  return Object.freeze({
    id,
    label,
    description,
    columns: Object.freeze([...columns]),
    article,
  });
}

export const DEFAULT_BAMBOO_NOTICE_CONTENT_ID = "spring-autumn";

export const CHANGMEN_HISTORY_CONTENTS = Object.freeze([
  createHistoryContent(
    "spring-autumn",
    "春秋建城",
    "阖闾大城与阊门的位置",
    [
      "春秋后期",
      "吴国长期与楚越交战",
      "都城缺少可靠防御",
      "据文献记载前514年",
      "阖闾命伍子胥筑城",
      "伍子胥察看地势水情",
      "规划建造阖闾大城",
      "阊门设在古城西北",
      "此后城址长期未移",
    ],
    "春秋后期，吴国长期与楚国、越国交战，都城防御成为现实需要。据文献记载，公元前514年，吴王阖闾命伍子胥主持建城。伍子胥察看地势与水情后规划建造阖闾大城，阊门设在古城西北，此后苏州古城城址长期未移。",
  ),
  createHistoryContent(
    "tang",
    "唐代山塘",
    "白居易修筑堤路与山塘河之辨",
    [
      "唐代",
      "阊门外通往虎丘",
      "825年白居易任苏州刺史",
      "他组织修筑堤路",
      "改善这一带陆路通行",
      "堤路后来发展为山塘街",
      "后世方志记有开河之说",
      "较早资料只写修建堤路",
      "是否新开河道仍有争议",
    ],
    "825年，白居易出任苏州刺史，组织修筑阊门至虎丘一带的堤路，改善陆路通行，堤路后来发展为山塘街。后世方志记有开凿山塘河的说法，但较早资料只明确记载修建堤路，因此究竟是新开河道还是整治原有水道，仍需区分说明。",
  ),
  createHistoryContent(
    "southern-song",
    "南宋图证",
    "《平江图》中的水门与陆门",
    [
      "南宋时期",
      "1229年平江图刻成",
      "它记录当时苏州城布局",
      "图中阊门设有水陆两门",
      "陆门连接城内外道路",
      "水门让船只穿过城墙",
      "城内河道由水门出城",
      "水陆通道分别组织交通",
      "也共同承担城防管理",
    ],
    "南宋绍定二年，也就是1229年，《平江图》刻成，记录了当时苏州的城墙、河道、街巷和城门。图中阊门同时设有陆门和水门：陆门连接城内外道路，水门让船只和河道穿过城墙，两者分别组织水陆交通，也共同承担城防管理。",
  ),
  createHistoryContent(
    "ming-qing",
    "明清商贸",
    "从转运码头到明清街市",
    [
      "明清时期",
      "明代商贸中心移向阊门",
      "西中市南濠山塘相连",
      "河岸聚集商铺会馆码头",
      "货物在这里装卸转运",
      "清代商业规模继续扩大",
      "1759年徐扬完成长卷",
      "画中记录阊门街市",
      "今称姑苏繁华图",
    ],
    "明代苏州的商贸中心逐渐移向阊门，西中市、南濠和山塘相互连接，河岸聚集商铺、会馆与码头，货物在这里装卸转运。清代商业规模继续扩大。1759年，徐扬完成《盛世滋生图》长卷，今天通常称为《姑苏繁华图》，画中详细记录了阊门一带的街市。",
  ),
  createHistoryContent(
    "modern",
    "近现代变迁",
    "从城防退场到遗址保护",
    [
      "近现代变迁",
      "1863年以后",
      "城墙防御作用日益减弱",
      "到1952年底",
      "全城已有23处缺口",
      "1956年起绿化遗址",
      "八十年代初调查",
      "古城墙仅存5.02公里",
      "北码头段新建修复465米",
    ],
    "1863年以后，城墙的军事防御作用日益减弱，墙体不断坍塌和拆损。到1952年底，苏州全城城墙已有23处缺口；1956年起，苏州开始绿化城墙遗址。20世纪80年代初调查时，古城墙仅存5.02公里。此后阊门北码头段新建、修复砖石城墙共465米。",
  ),
]);

export const BAMBOO_NOTICE_CONTENTS = Object.freeze(
  Object.fromEntries(CHANGMEN_HISTORY_CONTENTS.map((content) => [content.id, content])),
);

export const BAMBOO_NOTICE_CONTENT_OPTIONS = CHANGMEN_HISTORY_CONTENTS;

export function getBambooNoticeContent(contentId = DEFAULT_BAMBOO_NOTICE_CONTENT_ID) {
  return BAMBOO_NOTICE_CONTENTS[contentId]
    ?? BAMBOO_NOTICE_CONTENTS[DEFAULT_BAMBOO_NOTICE_CONTENT_ID];
}

export const CHANGMEN_INFO_CONTENTS = Object.freeze({
  culture: Object.freeze({
    id: "culture",
    label: "历史文化",
    title: "街巷、园林与传统手艺",
    article:
      "阊门历史文化街区的价值不只在城门遗址。保护对象还包括西中市、吴趋坊等街巷，艺圃、五峰园等园林，会馆、故居和民国建筑，以及灯彩、木刻年画、玉雕、苏绣等传统手艺和轧神仙等民俗活动。",
  }),
  geography: Object.freeze({
    id: "geography",
    label: "地理位置",
    title: "古城西北的水陆交会点",
    article:
      "阊门位于苏州古城西北部，城内连接西中市和吴趋坊，城外衔接北码头、山塘与外城河。水门接通城内河道与护城河，陆门承接城内外道路。街区保护范围为24.78公顷，建设控制地带为31.84公顷。",
  }),
});
