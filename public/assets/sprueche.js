/*
 * Gemeinsame Sprüche für jeden Avatar an jedem Tisch.
 * Große deutsche Vorräte, ein Beutel ohne Wiederholung, und ein Abstand
 * zwischen den Bemerkungen. Zuletzt Gesagtes bleibt auf diesem Gerät.
 * Die Stimme kommt vom Server. Fällt sie aus, bleibt nur der Text.
 */
(function (root, factory) {
  var api = factory();
  if (root) root.SpielpartnerSprueche = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var POOLS = {
  "horst": {
    "greetings": [
      "Na endlich. Setz dich, ick hab dir den Platz frei gehalten.",
      "N Abend. Schön, dass de da bist.",
      "Moin. Heute wird et gemütlich, versprochen.",
      "Da biste ja. Ick hab extra nich gemeckert.",
      "Hallo. Stell die Tasche ab und misch mit.",
      "Schön, dich zu sehen. Sag det aber keinem.",
      "N Abend zusammen. Ick freu mir, ehrlich.",
      "Setz dich, Kollege. Der Tisch is frei.",
      "Na jut, du bist da. Dann kann et losgehen.",
      "Willkommen. Ick pass uff dich uff.",
      "Komm rin. Die Karten sind schon neugierig.",
      "Ick nick dir zu. Die Begrüßung is kurz, aber ehrlich."
    ],
    "bidding": [
      "Det reizen wa mal in Ruhe.",
      "Ick geh mit. Mal sehen, wohin et führt.",
      "Na, traust dir wat? Ick ooch.",
      "Weg. Diesmal lass ick euch den Vortritt.",
      "Ick passe. Mit dem Blatt wird et nix, und det is ooch in Ordnung.",
      "So, ick sag an. Ganz ohne Theater.",
      "Höher muss nich immer besser sein.",
      "Ick bleib dabei. Und ihr dürft mitlachen.",
      "Na schön, ick spiele. Passt uff, aber nett.",
      "Diesmal halt ick mich zurück. Ist ooch mal schön.",
      "Ick geh ein Stück mit, dann sehen wa.",
      "Ansage is raus. Nu seid freundlich."
    ],
    "winning": [
      "Jewonnen. Hat Spaß jemacht, wa?",
      "Na also. Det saß, und ick freu mir.",
      "Ick nehm den Punkt mit, und das Lächeln dazu.",
      "Schön für uns. Nächste Runde seid ihr dran.",
      "Det hat sich jelohnt. Danke fürs Mitspielen.",
      "Ha, diesmal hat et geklappt.",
      "Punkt für uns. Ihr wart stark.",
      "So mag ick det. Klar und freundlich.",
      "Gewonnen, und keener muss schmollen.",
      "Det war unser Spiel. Gut gemacht.",
      "Ick sag nur: weiter so.",
      "Ein schöner Punkt. Ick gönn ihn uns."
    ],
    "losing": [
      "Diesmal ihr. Respekt.",
      "Na jut, der Punkt gehört euch.",
      "Ihr habt sauber gespielt. Ick zieh den Hut.",
      "Macht nix. Ick bleib guter Dinge.",
      "Schön gespielt. Ick lern noch.",
      "Nächstes Mal dreh ick det, ganz in Ruhe.",
      "Alles gut. Ick gönn euch det.",
      "Ick nehm et mit Humor.",
      "Verloren, aber der Abend bleibt schön.",
      "Ihr habt et euch erspielt. Ehrlich.",
      "Kopf hoch bei mir, und bei euch Applaus.",
      "Nich schlimm. Die nächste Runde lacht schon."
    ],
    "goodMove": [
      "Zack. Det war fein.",
      "Na, die Karte saß.",
      "Danke, det hat uns den Stich gebracht.",
      "Schön gelegt. Ick hab et gesehen.",
      "Volle Hütte, und ganz ruhig.",
      "Det nenn ick mitdenken.",
      "Klasse. So spielt man zusammen.",
      "Die Augen nehm ick gerne, danke.",
      "Sauber. Weiter so.",
      "Det war genau die richtige Karte.",
      "Ick nick dir zu. Mehr braucht et nich.",
      "Fein gemacht. Ick bin beeindruckt."
    ],
    "badLuck": [
      "Och. Die Karte wollte nich.",
      "Macht nix, det kommt vor.",
      "Pech gehabt. Nächster Stich wird besser.",
      "Na, det Blatt is heute ein bisschen eigen.",
      "Ick lächle trotzdem.",
      "Schade, aber wir bleiben freundlich.",
      "Die Karten haben heut ihren eigenen Kopf.",
      "Nich schlimm. Wir spielen weiter.",
      "Det war knapp daneben.",
      "Ick schüttel nur den Kopf und bleib guter Laune.",
      "Alles gut. Ein Stich macht noch keen Spiel.",
      "Wir lachen und legen die nächste."
    ],
    "banter": [
      "Schön, dass wa zusammen sitzen.",
      "Ick erzähl heute nix vom Vermieter. Versprochen.",
      "Der Tisch is ruhig. Gefällt mir.",
      "Noch ne Runde? Ick bin dabei.",
      "Ick halt die Klappe und genieß et.",
      "Wat für n gemütlicher Abend.",
      "Ick pass auf die Karten auf, und auf euch.",
      "Zwischendurch einfach mal durchatmen.",
      "Berlin grüßt den Tisch. Ganz ohne Meckern.",
      "Ick freu mir über jede Karte, die stimmt.",
      "Lasst uns fair bleiben. Ick geb mir Mühe.",
      "Na, wer hat Lust auf die nächste?"
    ]
  },
  "margarethe": {
    "greetings": [
      "Ach, da bist Du ja, Schätzchen. Setz Dich zu mir.",
      "Guten Abend. Wie schön, dass der Tisch wieder voll ist.",
      "Willkommen. Ich habe den Platz extra hübsch gelassen.",
      "Hallo, mein Lieber. Die Perlen und ich freuen uns.",
      "Komm nur. Es ist gemütlich wie im Salon.",
      "Guten Abend zusammen. Heute spielen wir mit Stil.",
      "Schön, Dich zu sehen. Das hebt meine Laune.",
      "Setz Dich, Schätzchen. Der Abend gehört uns.",
      "Na endlich ein bekanntes Gesicht. Herzlich willkommen.",
      "Ich nicke Dir zu. Mehr braucht eine Dame nicht, aber es ist herzlich.",
      "Guten Abend. Ich habe schon gelächelt, bevor Du kamst.",
      "Hereinspaziert. Die Karten warten artig."
    ],
    "bidding": [
      "Ich gehe mit, Schätzchen. Ganz in Ruhe.",
      "Nur nicht so zaghaft. Wir bleiben trotzdem höflich.",
      "Ich passe. Eine Dame weiß, wann sie lächelt und wartet.",
      "Diesmal überlasse ich Euch die Bühne.",
      "Höher, aber mit Haltung.",
      "Ich sage an. Seht hin, es wird hübsch.",
      "Ich halte mich zurück. Das steht mir auch.",
      "So, das ist meine Ansage. Applaus ist freiwillig.",
      "Ich gehe ein Stück mit. Danach sehen wir.",
      "Nicht zu hoch. Eleganz ist auch Maß.",
      "Ich spiele. Und ich nehme Euch nett mit.",
      "Die Ansage steht. Nun genießen wir es."
    ],
    "winning": [
      "Gewonnen. Ich verbeuge mich nur ein ganz klein wenig.",
      "Wie hübsch. Der Punkt steht uns gut.",
      "Applaus ist erlaubt, Schätzchen.",
      "Das war ein Fest. Danke fürs Mitspielen.",
      "Gewonnen, und niemand muss schmollen.",
      "Ich freue mich. Sogar ein wenig laut.",
      "So spielt man in guter Gesellschaft.",
      "Der Punkt gehört uns. Ich teile die Freude.",
      "Herrlich. Wie ein ruhiger Abend auf dem Balkon.",
      "Ich wusste, dass wir das freundlich schaffen.",
      "Bravo an uns alle. Wirklich.",
      "Ein schöner Sieg. Ich hebe das Gläschen nur in Gedanken."
    ],
    "losing": [
      "Diesmal Ihr. Ich gratuliere von Herzen.",
      "Das war elegant von Euch. Ich bin beeindruckt.",
      "Ach, nicht schlimm. Ich trage es mit Fassung.",
      "Bravo, Schätzchen. Der Punkt steht Euch gut.",
      "Nächstes Mal lächle ich von der anderen Seite.",
      "Ihr habt das verdient gespielt. Wirklich.",
      "Ich verliere ungern, aber heute gerne gegen Euch.",
      "Macht nichts. Der Abend bleibt goldig.",
      "Ich nicke. Das war Euer Spiel.",
      "Nicht traurig sein, ich bin es auch nicht.",
      "Sauber gespielt. Ich klatsche leise.",
      "Die nächste Runde wird wieder charmant."
    ],
    "goodMove": [
      "Oh, wie hübsch. Die nehme ich mit Dank.",
      "Das war natürlich Absicht, Schätzchen.",
      "Herrlich gelegt. Ich habe es gesehen.",
      "Danke. Das war aufmerksam.",
      "So gefällt mir das. Fein und ruhig.",
      "Eine wunderbare Karte. Wirklich.",
      "Das sitzt. Ich lächle in die Runde.",
      "Bravo. So spielt man zusammen.",
      "Die Augen nehme ich gerne, mit einem Nicken.",
      "Genau die richtige Karte. Ich bin entzückt.",
      "Schön gemacht. Das erzähle ich freundlich weiter.",
      "Das war Stil. Mehr sage ich nicht, aber ich meine es."
    ],
    "badLuck": [
      "Huch. Das Blatt ist heute ein wenig eigensinnig.",
      "Nicht schlimm, Schätzchen. Die nächste Karte lächelt wieder.",
      "Ach, wie schade. Aber wir bleiben heiter.",
      "Das war knapp daneben. Ich nehme es leicht.",
      "Die Karten haben heute ihren eigenen Geschmack.",
      "Macht nichts. Ich richte meine Perlen und spiele weiter.",
      "Pech, aber kein Grund für eine Falte auf der Stirn.",
      "Wir lachen kurz und legen neu.",
      "Das bleibt unter uns, und es ist nicht schlimm.",
      "Ein Stich ist noch kein Abend.",
      "Ich atme durch. Gleich wird es hübscher.",
      "Schade, und trotzdem ein schöner Tisch."
    ],
    "banter": [
      "Wie gemütlich. Fast wie im Salon.",
      "Ich erzähle heute nicht von der Kreuzfahrt. Heute zählt der Tisch.",
      "Ein ruhiger Abend ist auch ein guter Abend.",
      "Schätzchen, wir haben Zeit. Genieß sie.",
      "Ich sehe in die Runde und finde sie reizend.",
      "Noch eine Runde? Ich bin dabei, mit Vergnügen.",
      "Die Perlen bleiben still. Ich auch, für einen Moment.",
      "Was für ein freundlicher Tisch.",
      "Ich hebe das Glas nur in Gedanken.",
      "Lasst uns fair bleiben. Das steht uns allen.",
      "Zwischendurch einfach lächeln.",
      "Ich freue mich, dass wir zusammen sitzen."
    ]
  },
  "urs": {
    "greetings": [
      "Grüezi. Hock di, es pressiert nid.",
      "Schön, dass du da bist. Der Platz ist frei.",
      "Guet, dann sind wir vollzählig.",
      "Willkommen. Wir nehmen das ruhig.",
      "Hoi zusammen. Ich freue mich ehrlich.",
      "Setz dich. Die Karten warten ohne Hast.",
      "Grüezi miteinand. Heute bleibt es gemütlich.",
      "Da bist du ja. Das ist schön.",
      "Komm nur. Es hat Zeit.",
      "Ich nicke dir zu. Mehr braucht es nicht.",
      "Willkommen am Tisch. Wir spielen fair.",
      "Schön, dich zu sehen. Wirklich."
    ],
    "bidding": [
      "Guet. Ich gehe ein Stück mit.",
      "Ich passe. Ruhig bleiben ist auch ein Zug.",
      "Wir sagen an, ohne Lärm.",
      "Nicht zu hoch. Das Blatt mag Maß.",
      "Ich halte mit. Mal sehen.",
      "So, das ist meine Ansage. Ganz gelassen.",
      "Ich lasse euch den Vortritt. Gern.",
      "Wir reizen in Ruhe.",
      "Ich spiele. Und ich nehme euch nett mit.",
      "Ein Schritt höher, nicht mehr.",
      "Das genügt. Wir sehen weiter.",
      "Ansage steht. Nun spielen wir freundlich."
    ],
    "winning": [
      "Guet. Das haben wir ruhig verdient gespielt.",
      "Ein schöner Punkt. Ich freue mich leise.",
      "So ist es recht.",
      "Gewonnen, und niemand muss sich ärgern.",
      "Das saß. Danke fürs Mitspielen.",
      "Ich nicke. Das war unseres.",
      "Schön für uns. Nächste Runde seid ihr dran.",
      "Das war sauber. Mehr will ich nicht.",
      "Ein Punkt mit Ruhe. Gefällt mir.",
      "Wir haben das zusammen gelegt.",
      "Ich lächle nur kurz. Es reicht.",
      "Weiter so. Ganz ohne Hast."
    ],
    "losing": [
      "Nid schlimm. Nächste Runde.",
      "Ihr habt sauber gespielt. Respekt.",
      "Der Punkt gehört euch. Gern.",
      "Ich nehme das gelassen.",
      "Schön gemacht. Ich gönne es euch.",
      "Macht nichts. Der Tisch bleibt freundlich.",
      "Nächstes Mal vielleicht. Heute ihr.",
      "Ich nicke. Das war euer Spiel.",
      "Alles gut. Wir bleiben sitzen.",
      "Kein Ärger. Nur ein Punkt auf der anderen Seite.",
      "Ich freue mich für euch.",
      "Die nächste Runde kommt von allein."
    ],
    "goodMove": [
      "Dä Stich bleibt da. Schön gelegt.",
      "Guet gemacht.",
      "Genau die Karte. Ich habe es gesehen.",
      "Danke. Das hilft uns.",
      "Ruhig und richtig. So mag ich das.",
      "Sauber. Weiter so.",
      "Das war mitgedacht.",
      "Ich nicke dir zu.",
      "Fein. Der Stich sitzt.",
      "Zusammen geht das besser.",
      "Eine gute Karte. Wirklich.",
      "Das merke ich mir freundlich."
    ],
    "badLuck": [
      "Nid schlimm. Die Karte wollte nicht.",
      "Pech. Die nächste wird besser.",
      "Wir bleiben ruhig.",
      "Das Blatt ist heute eigen. Macht nichts.",
      "Knapp daneben. Ich lächle trotzdem.",
      "Ein Stich ist noch kein Spiel.",
      "Schade, und wir spielen weiter.",
      "Ich atme durch.",
      "Alles gut. Neu legen.",
      "Die Karten haben ihren eigenen Sinn heute.",
      "Kein Grund zur Eile, und kein Grund zum Ärger.",
      "Wir lachen kurz und machen weiter."
    ],
    "banter": [
      "Es pressiert nid. Wirklich nicht.",
      "Ein stiller Tisch ist ein guter Tisch.",
      "Ich schaue in die Runde und bin zufrieden.",
      "Noch eine Runde? Ich bin dabei.",
      "Wir haben Zeit.",
      "Guet so. Einfach sitzen und spielen.",
      "Ich sage nicht viel. Das ist meine Art von Freundlichkeit.",
      "Schön, dass wir zusammen sind.",
      "Zwischendurch einmal durchatmen.",
      "Fair bleiben. Das ist mir wichtig.",
      "Der Abend darf ruhig sein.",
      "Ich freue mich, ohne viel Worte."
    ]
  },
  "vreni": {
    "greetings": [
      "Hoi. Jetzt wird es lustig, oder?",
      "Schön, dass du da bist. Setz dich schnell, aber freundlich.",
      "Hallo zusammen. Ich bin wach und guter Dinge.",
      "Willkommen. Ich habe schon gelacht.",
      "Hoi miteinand. Der Tisch ist frei.",
      "Da bist du ja. Endlich wird es lebendig.",
      "Grüezi, auf meine Art. Herzlich.",
      "Komm ran. Ich freue mich.",
      "Schön dich zu sehen. Ehrlich.",
      "Hallo. Heute bleiben wir fröhlich.",
      "Willkommen. Ich passe auf, dass es nett bleibt.",
      "Hoi. Die Karten können kommen."
    ],
    "bidding": [
      "Also denn. Ich gehe mit, aber nicht wild.",
      "Ich passe. Lieber lachen als zu hoch greifen.",
      "Das ist meine Ansage. Schaut her.",
      "Ein bisschen höher, und dann reicht es.",
      "Ich halte mit. Mal sehen, oder?",
      "Nicht meckern, einfach ansagen.",
      "Ich lasse euch vor. Gern.",
      "So, gespielt wird freundlich.",
      "Ich sage es klar und bleibe nett.",
      "Maß halten. Das kann ich auch.",
      "Die Ansage steht. Los, mit Spaß.",
      "Ich spiele. Und ich nehme euch mit."
    ],
    "winning": [
      "Gsehsch. Hat Spaß gemacht.",
      "Gewonnen. Ich lache, aber nicht über euch.",
      "Punkt für uns. Ihr wart trotzdem stark.",
      "Schön. Das hat gesessen.",
      "Ich habs doch freundlich gesagt.",
      "Weiter so. Nächste Runde seid ihr dran.",
      "Das war flott und fair.",
      "Ich freue mich. Richtig.",
      "Sauber gewonnen. Danke euch.",
      "So mag ich das.",
      "Ein Punkt mit Schwung.",
      "Bravo an den Tisch."
    ],
    "losing": [
      "Pfuus, aber nur kurz. Ihr habt das gut gemacht.",
      "Respekt. Der Punkt ist euer.",
      "Nächstes Mal stimmt die Karte. Heute ihr.",
      "Ich lache mit. Wirklich.",
      "Sauber gespielt. Ich gönne es euch.",
      "Nicht hängen lassen, auch ich nicht.",
      "Alles gut. Der Abend bleibt lustig.",
      "Ich nicke. Das war eures.",
      "Schade für mich, schön für euch.",
      "Wir spielen weiter, oder?",
      "Kein Schmollen. Versprochen.",
      "Die nächste Runde hole ich mit einem Lächeln."
    ],
    "goodMove": [
      "Weg damit, der Stich ist unserer. Schön.",
      "Genau so. Das war flink und richtig.",
      "Danke. Die Karte war goldrichtig.",
      "Hah, fein gelegt.",
      "Das nenne ich mitdenken.",
      "Sauber. Ich habs gesehen.",
      "Zusammen sind wir schnell.",
      "Die Augen nehme ich gerne.",
      "Klasse Zug. Wirklich.",
      "So bleibt es lustig und klug.",
      "Ich klatsche leise.",
      "Weiter so, oder?"
    ],
    "badLuck": [
      "Och. Die Karte hatte andere Pläne.",
      "Macht nichts. Nächster Stich.",
      "Pech, und ich lache trotzdem.",
      "Knapp daneben. Typisch, und nicht schlimm.",
      "Das Blatt ist heute frech. Wir auch, aber nett.",
      "Ein Stich macht noch kein Spiel.",
      "Schade. Wir legen einfach weiter.",
      "Ich schüttle den Kopf und grinse.",
      "Alles gut. Wirklich.",
      "Die nächste Karte wird freundlicher.",
      "Nicht ärgern. Ich pass auf uns auf.",
      "Wir atmen einmal und machen weiter."
    ],
    "banter": [
      "Ich schlafe nicht am Tisch. Versprochen, und ich lache dafür.",
      "Schön lebendig heute, oder?",
      "Noch eine Runde? Ich bin dabei.",
      "Zwischendurch darf man grinsen.",
      "Ich mag diesen Tisch.",
      "Fair bleiben, auch wenn es schnell geht.",
      "Hoi nochmal in die Runde. Nur so.",
      "Der Abend ist gut.",
      "Ich halte die Klappe für einen Moment. Selten, aber schön.",
      "Wer hat Lust auf die nächste?",
      "Zusammen spielt es sich leichter.",
      "Ich freue mich einfach."
    ]
  },
  "sepp": {
    "greetings": [
      "Servus. Setz di her, die Karten warten.",
      "Guten Abend. Schön, dass du da bist.",
      "Basst. Der Platz ist frei.",
      "Servus miteinand. Heute bleibt es gemütlich.",
      "Komm rei. Ich freu mich.",
      "Grüß dich. Der Tisch ist ruhig und freundlich.",
      "Willkommen. Wir haben Zeit.",
      "Da bist du ja. Gut so.",
      "Servus. Ich nick dir zu.",
      "Schön dich zu sehen. Ehrlich.",
      "Hock di. Es pressiert nicht.",
      "Guten Abend. Dann kann es losgehen."
    ],
    "bidding": [
      "Basst. Ich geh ein Stück mit.",
      "Ich pass. Lieber ruhig als zu hoch.",
      "So, ich sag an. Ganz ohne Getue.",
      "Ein bisserl höher, dann sehen wir.",
      "Ich lass euch den Vortritt. Gern.",
      "Die Ansage steht. Spielen wir freundlich.",
      "Ich halt mit. Mal schauen.",
      "Nicht zu wild. Das Blatt mag Maß.",
      "Ich spiel. Und ich nehm euch nett mit.",
      "Gemmas halt, in Ruhe.",
      "Das reicht. Mehr muss nicht sein.",
      "Ansage ist raus. Ich bleib gut gelaunt."
    ],
    "winning": [
      "Schau her. So geht das, ganz freundlich.",
      "Gewonnen. Ich freu mich leise.",
      "Ein schöner Punkt. Danke euch.",
      "Basst. Das hat gesessen.",
      "Schön für uns. Nächste Runde seid ihr dran.",
      "Sauber gespielt, von uns allen.",
      "Ich nick. Das war unseres.",
      "So mag ich das.",
      "Ein Punkt ohne Lärm. Gut.",
      "Weiter so.",
      "Das gönn ich uns.",
      "Fein. Der Abend stimmt."
    ],
    "losing": [
      "Mei. Ihr habt das sauber gemacht.",
      "Der Punkt gehört euch. Gern.",
      "Nächstes Mal wird es feiner. Heute ihr.",
      "Ich gönn es euch.",
      "Macht nichts. Wir bleiben sitzen.",
      "Respekt. Wirklich.",
      "Alles gut. Der Tisch bleibt freundlich.",
      "Ich nehm das mit einem Schmunzeln.",
      "Schön gespielt.",
      "Kein Grant. Nur ein Punkt auf eurer Seite.",
      "Die nächste Runde kommt schon.",
      "Ich freu mich für euch."
    ],
    "goodMove": [
      "Des war ein sauberer Stich. Passt schon.",
      "Fein gelegt. Danke.",
      "Genau die Karte.",
      "So spielt man zusammen.",
      "Ich habs gesehen. Gut gemacht.",
      "Die Augen nehm ich gerne.",
      "Basst. Weiter so.",
      "Das war mitgedacht.",
      "Schön ruhig und richtig.",
      "Zusammen geht das besser.",
      "Klasse. Ich nick dir zu.",
      "Das merke ich mir freundlich."
    ],
    "badLuck": [
      "Mei. Die Karte war heut grantig, ich nicht.",
      "Pech gehabt. Nächster Stich.",
      "Macht nichts.",
      "Knapp daneben. Ich schmunzle.",
      "Das Blatt hat seinen eigenen Kopf.",
      "Ein Stich ist noch kein Spiel.",
      "Schade, und wir spielen weiter.",
      "Alles gut. Wirklich.",
      "Ich atme durch und leg die nächste.",
      "Kein Grund zum Ärger.",
      "Die nächste wird freundlicher.",
      "Wir lachen kurz und machen weiter."
    ],
    "banter": [
      "Nach der Runde schauen wir weiter. Jetzt ist es gemütlich.",
      "Schön, dass wir beisammen sind.",
      "Noch eine? Ich bin dabei.",
      "Ich sag nicht viel. Das ist schon ein Gruß.",
      "Der Abend passt.",
      "Fair bleiben. Das mag ich.",
      "Zwischendurch einmal durchschnaufen.",
      "Servus nochmal in die Runde.",
      "Ich freu mich, ohne viel Worte.",
      "Der Tisch ist gut so.",
      "Lasst uns in Ruhe spielen.",
      "Wer mag die nächste Runde?"
    ]
  },
  "hilde": {
    "greetings": [
      "Na, Kind. Der Kaffee steht, die Karten auch.",
      "Schön, dass du da bist. Setz dich.",
      "Willkommen. Oma passt auf, dass es nett bleibt.",
      "Guten Abend. Der Platz ist warm.",
      "Komm nur. Es ist gemütlich.",
      "Na endlich ein bekanntes Gesicht. Herzlich.",
      "Hallo, Kind. Ich freue mich.",
      "Setz dich ruhig. Wir haben Zeit.",
      "Guten Abend zusammen. Heute wird es freundlich.",
      "Ich nicke dir zu. Das ist schon eine Umarmung.",
      "Willkommen am Tisch. Die Karten sind geduldig.",
      "Schön dich zu sehen. Wirklich."
    ],
    "bidding": [
      "Ganz ruhig. Ich gehe ein Stück mit.",
      "Ich passe. Warten ist auch klug.",
      "So, ich sage an. Ohne Hast.",
      "Nicht zu hoch, Kind. Maß ist gemütlich.",
      "Ich lasse euch vor. Gern.",
      "Die Ansage steht. Nun spielen wir friedlich.",
      "Ich halte mit. Mal sehen.",
      "Ein kleiner Schritt, mehr nicht.",
      "Ich spiele. Und ich nehme euch lieb mit.",
      "Das genügt. Wir sehen weiter.",
      "Ansage ist raus. Ich bleibe heiter.",
      "Wir reizen leise."
    ],
    "winning": [
      "Siehste. Leise geht das auch.",
      "Gewonnen. Ich freue mich wie über frischen Kuchen.",
      "Ein schöner Punkt. Danke euch.",
      "So ist es recht, Kind.",
      "Schön für uns. Nächste Runde seid ihr dran.",
      "Ich nicke. Das war unseres.",
      "Sauber und freundlich. Gut.",
      "Der Punkt steht uns gut.",
      "Ich lächle in die Runde.",
      "Weiter so, ganz ohne Eile.",
      "Das gönne ich uns.",
      "Fein gemacht, alle zusammen."
    ],
    "losing": [
      "Macht nichts. Ihr habt das lieb gespielt.",
      "Der Punkt gehört euch. Ich gönne ihn.",
      "Nicht ärgern. Es ist nur ein Spiel, und ein schönes.",
      "Respekt, Kind. Wirklich.",
      "Nächstes Mal wird es wieder meins. Heute eures.",
      "Ich bleibe guter Dinge.",
      "Schön gespielt.",
      "Alles gut. Der Kaffee ist trotzdem warm, in Gedanken.",
      "Ich nicke. Das war euer Spiel.",
      "Kein Schmollen. Versprochen.",
      "Die nächste Runde tröstet von allein.",
      "Ich klatsche leise für euch."
    ],
    "goodMove": [
      "Den Stich räume ich gerne weg. Schön gelegt.",
      "Danke, Kind. Das war aufmerksam.",
      "Genau die richtige Karte.",
      "So spielt man zusammen.",
      "Ich habe es gesehen. Fein.",
      "Die Augen nehme ich mit einem Nicken.",
      "Sauber. Weiter so.",
      "Das war mitgedacht.",
      "Ruhig und richtig. Gefällt mir.",
      "Zusammen ist es leichter.",
      "Klasse Zug. Ich sag es leise.",
      "Das merke ich mir freundlich."
    ],
    "badLuck": [
      "Ach. Die Karte wollte heute nicht.",
      "Nicht schlimm. Die nächste wird besser.",
      "Pech, und ich bleibe sanft.",
      "Knapp daneben. Macht nichts.",
      "Das Blatt ist heute eigen. Wir nicht.",
      "Ein Stich ist noch kein Abend.",
      "Schade. Wir legen einfach weiter.",
      "Ich atme durch.",
      "Alles gut, Kind.",
      "Wir lachen kurz und machen weiter.",
      "Kein Grund zur Eile.",
      "Die nächste Karte bringt wieder Ruhe."
    ],
    "banter": [
      "Gemütlich bleiben. Das ist meine ganze Weisheit.",
      "Schön, dass wir zusammen sitzen.",
      "Noch eine Runde? Ich bin dabei.",
      "Ich schaue in die Runde und bin zufrieden.",
      "Zwischendurch einfach mal still lächeln.",
      "Der Abend darf weich sein.",
      "Fair bleiben. Das mag ich.",
      "Ich freue mich ohne viele Worte.",
      "Wer hat Lust auf die nächste?",
      "Der Tisch ist gut so.",
      "Ich pass auf uns auf.",
      "Lasst uns in Ruhe spielen."
    ]
  },
  "lena": {
    "greetings": [
      "Hallo. Schön, dass du da bist. Die Karten können los.",
      "Moin. Ich komme gerade gut gelaunt an den Tisch.",
      "Willkommen. Fair spielen, und dann sehen wir.",
      "Hallo zusammen. Ich freue mich.",
      "Setz dich. Der Platz ist frei.",
      "Schön dich zu sehen. Ehrlich.",
      "Guten Abend. Ich bin dabei.",
      "Na, da bist du ja. Gut so.",
      "Willkommen in der Runde. Es bleibt freundlich.",
      "Ich nicke dir zu. Das reicht als Hallo, und es ist herzlich.",
      "Hallo. Heute haben wir Zeit füreinander.",
      "Komm ran. Ich passe auf, dass es nett bleibt."
    ],
    "bidding": [
      "Alles klar. Ich gehe ein Stück mit.",
      "Ich passe. Lieber fair als zu hoch.",
      "So, ich sage an. Klar und ruhig.",
      "Ein bisschen höher, dann reicht es.",
      "Ich lasse euch vor. Gern.",
      "Die Ansage steht. Wir bleiben sportlich.",
      "Ich halte mit. Mal sehen.",
      "Nicht hetzen. Die Karten mögen das nicht.",
      "Ich spiele. Und ich nehme euch fair mit.",
      "Maß halten kann ich auch.",
      "Ansage ist raus. Los, mit Respekt.",
      "Wir sagen es klar und bleiben nett."
    ],
    "winning": [
      "Läuft. Und ihr wart trotzdem stark.",
      "Gewonnen. Nächstes Mal darfst du.",
      "Punkt für uns. Danke fürs Mitspielen.",
      "Sauber. Das hat Spaß gemacht.",
      "Ich freue mich, ohne anzugeben.",
      "Schön für uns. Die nächste ist offen.",
      "So mag ich das. Fair und klar.",
      "Gut gemacht, alle zusammen.",
      "Ein Punkt mit leichtem Lächeln.",
      "Weiter so.",
      "Das gönne ich uns.",
      "Respekt an den Tisch."
    ],
    "losing": [
      "Gut, das war deins. Respekt.",
      "Der Punkt gehört euch. Zu Recht.",
      "Alles gut. Ich hole die nächste freundlich.",
      "Sauber gespielt. Ich gönne es euch.",
      "Kein Frust. Versprochen.",
      "Ihr habt das aufmerksam gelegt.",
      "Ich nicke. Das war euer Spiel.",
      "Nächste Runde wieder von vorn, mit Spaß.",
      "Ihr wart wach. Gefällt mir.",
      "Ich bleibe guter Dinge.",
      "Der Abend ist trotzdem schön.",
      "Weiter geht es, fair wie vorher."
    ],
    "goodMove": [
      "Der Stich ist unserer. Tut mir fast leid, so schön war er.",
      "Genau die Karte. Danke.",
      "Sauber gelegt.",
      "Das war fair und klug.",
      "Ich habs gesehen. Gut.",
      "Zusammen klappt das.",
      "Fein. Weiter so.",
      "Die Augen nehme ich mit einem Nicken.",
      "Klasse Zug.",
      "So spielt man im Team.",
      "Respekt für die Karte.",
      "Das merke ich mir."
    ],
    "badLuck": [
      "Okay, das saß daneben. Nicht schlimm.",
      "Pech. Nächster Zug.",
      "Macht nichts. Ich bleib locker.",
      "Knapp. Die Karte wollte nicht.",
      "Ein Stich ist noch kein Spiel.",
      "Schade, und wir machen weiter.",
      "Alles gut. Wirklich.",
      "Ich atme durch.",
      "Das Blatt ist heute widerspenstig. Wir nicht.",
      "Kein Drama. Nur die nächste Karte.",
      "Wir lachen kurz.",
      "Gleich wird es wieder klarer."
    ],
    "banter": [
      "Kurze Pause im Kopf. Dann die nächste Karte.",
      "Schön, dass wir zusammen spielen.",
      "Noch eine Runde? Ich bin dabei.",
      "Fair bleiben. Das ist mein Ding.",
      "Ich mag diesen Tisch.",
      "Zwischendurch einfach grinsen.",
      "Der Abend passt.",
      "Ich sag nicht viel, aber ich bin da.",
      "Wer hat Lust auf die nächste?",
      "Zusammen ist es leichter.",
      "Ich freue mich einfach.",
      "Lasst uns sportlich bleiben, und freundlich."
    ]
  },
  "jonas": {
    "greetings": [
      "Schön, dass du da bist. Die Tür hab ich schon aufgehalten.",
      "Guten Abend. Setz dich, es ist Platz.",
      "Willkommen. Ich freue mich, dich zu sehen.",
      "Hallo. Der Tisch ist ruhig und freundlich.",
      "Guten Abend zusammen. Wir haben Zeit.",
      "Da bist du ja. Gut so.",
      "Willkommen in der Runde.",
      "Ich nicke dir zu. Herzlich.",
      "Komm nur. Es pressiert nicht.",
      "Schön dich zu sehen. Ehrlich.",
      "Guten Abend. Heute bleiben wir aufmerksam zueinander.",
      "Setz dich. Ich passe auf, dass es nett bleibt."
    ],
    "bidding": [
      "Ruhig bleiben. Ich gehe ein Stück mit.",
      "Ich passe. Das ist auch eine höfliche Antwort.",
      "So, ich sage an. Klar und ohne Eile.",
      "Nicht zu hoch. Das Blatt mag Maß.",
      "Ich lasse euch vor. Gern.",
      "Die Ansage steht. Wir spielen aufmerksam.",
      "Ich halte mit. Mal sehen.",
      "Ein kleiner Schritt genügt.",
      "Ich spiele. Und ich nehme euch rücksichtsvoll mit.",
      "Wir sagen es leise und deutlich.",
      "Ansage ist raus. Nun die Karten.",
      "Maß ist auch Mut."
    ],
    "winning": [
      "Das saß. Ich lächle trotzdem, mit euch.",
      "Gewonnen. Danke fürs faire Spiel.",
      "Ein schöner Punkt.",
      "Schön für uns. Die nächste Runde ist offen.",
      "Sauber. Das hat Freude gemacht.",
      "Ich nicke. Das war unseres.",
      "Gut gemacht, alle zusammen.",
      "So mag ich das.",
      "Ein Punkt ohne Aufheben. Gut.",
      "Weiter so.",
      "Das gönne ich uns.",
      "Respekt an den Tisch."
    ],
    "losing": [
      "Sauber gespielt. Das nehme ich mit.",
      "Der Punkt gehört euch. Zu Recht.",
      "Ich gratuliere, ganz ruhig.",
      "Alles gut. Nächste Runde wieder von vorn.",
      "Ihr habt das ruhig und richtig gemacht.",
      "Kein Ärger. Versprochen.",
      "Ihr wart aufmerksam. Gefällt mir.",
      "Ich bleibe freundlich.",
      "Das war euer Spiel. Ich nicke.",
      "Der Abend bleibt schön.",
      "Ich freue mich für euch.",
      "Weiter geht es, in Ruhe."
    ],
    "goodMove": [
      "Der Stich bleibt bei uns. Nichts für ungut, und danke.",
      "Genau die Karte. Aufmerksam gelegt.",
      "Schön gemacht.",
      "Das hilft uns. Danke.",
      "Ich habe es gesehen.",
      "Zusammen stimmt das.",
      "Fein. Weiter so.",
      "Sauber und ruhig.",
      "Klasse Zug.",
      "So spielt man rücksichtsvoll und klug.",
      "Ich nicke dir zu.",
      "Das merke ich mir freundlich."
    ],
    "badLuck": [
      "Knapp daneben. Nicht schlimm.",
      "Pech. Die nächste Karte kommt.",
      "Macht nichts. Ich bleibe ruhig.",
      "Das Blatt ist heute eigen.",
      "Ein Stich ist noch kein Spiel.",
      "Schade. Wir legen weiter.",
      "Alles gut.",
      "Ich atme durch.",
      "Kein Grund zur Eile.",
      "Wir lächeln und machen weiter.",
      "Die nächste wird klarer.",
      "Ich nehme das leicht."
    ],
    "banter": [
      "Nach dir. Ich habe Zeit.",
      "Schön, dass wir zusammen sitzen.",
      "Noch eine Runde? Gern.",
      "Ein ruhiger Tisch ist ein guter Tisch.",
      "Ich passe auf, dass wir freundlich bleiben.",
      "Zwischendurch einfach zuhören.",
      "Der Abend passt.",
      "Ich freue mich ohne viele Worte.",
      "Wer mag die nächste?",
      "Fair bleiben. Das ist mir wichtig.",
      "Zusammen spielt es sich besser.",
      "Ich bin einfach gern hier."
    ]
  },
  "oemer": {
    "greetings": [
      "Komm rein. Für dich ist ein Platz frei.",
      "Willkommen. Schön, dass du da bist.",
      "Guten Abend. Der Tisch ist gedeckt, die Karten auch.",
      "Hallo zusammen. Ich freue mich.",
      "Setz dich. Es ist gemütlich.",
      "Schön dich zu sehen. Ehrlich.",
      "Willkommen in der Runde. Heute bleibt es freundlich.",
      "Da bist du ja. Gut so.",
      "Guten Abend. Ich habe schon gelächelt.",
      "Komm nur. Wir haben Zeit.",
      "Ich nicke dir zu. Herzlich willkommen.",
      "Hallo. Die Karten warten, und ich auch."
    ],
    "bidding": [
      "So, ich gehe ein Stück mit. Ganz in Ruhe.",
      "Ich passe. Lieber Platz lassen als zu hoch greifen.",
      "Das ist meine Ansage. Klar und nett.",
      "Nicht zu hoch. Der Tisch mag Maß.",
      "Ich lasse euch vor. Gern.",
      "Die Ansage steht. Nun spielen wir mit Freude.",
      "Ich halte mit. Mal sehen.",
      "Ein kleiner Schritt, dann sehen wir.",
      "Ich spiele. Und ich nehme euch herzlich mit.",
      "Wir sagen es ohne Hast.",
      "Ansage ist raus. Bleibt guter Dinge.",
      "Maß halten ist auch Gastfreundschaft."
    ],
    "winning": [
      "Schön für uns. Lachen darfst du trotzdem.",
      "Gewonnen. Danke, dass ihr mitgespielt habt.",
      "Ein guter Punkt. Ich freue mich.",
      "So mag ich das. Herzlich und klar.",
      "Nächste Runde seid ihr dran. Gern.",
      "Sauber. Das hat Freude gemacht.",
      "Ich nicke in die Runde.",
      "Der Punkt steht uns gut.",
      "Weiter so.",
      "Das gönne ich uns.",
      "Fein gespielt, alle zusammen.",
      "Ein Sieg, über den niemand traurig sein muss."
    ],
    "losing": [
      "Macht nichts. Beim nächsten Mal gibt es trotzdem ein Lächeln.",
      "Ihr habt sauber gespielt. Respekt.",
      "Der Punkt gehört euch. Ich gönne ihn.",
      "Alles gut. Der Tisch bleibt warm.",
      "Schön gemacht.",
      "Ich freue mich für euch.",
      "Kein Ärger. Versprochen.",
      "Nächste Runde wieder von vorn.",
      "Das war euer Spiel. Ich nicke.",
      "Der Abend ist trotzdem schön.",
      "Ich bleibe guter Gastgeber, auch so.",
      "Weiter geht es, freundlich."
    ],
    "goodMove": [
      "Den Stich nehme ich mit Dank.",
      "Genau die Karte. Schön gelegt.",
      "Danke. Das hilft uns allen.",
      "So spielt man zusammen.",
      "Ich habe es gesehen. Fein.",
      "Sauber. Weiter so.",
      "Die Augen nehme ich gerne.",
      "Das war aufmerksam.",
      "Klasse Zug.",
      "Zusammen schmeckt der Stich besser.",
      "Ich nicke dir zu.",
      "Das merke ich mir herzlich."
    ],
    "badLuck": [
      "Pech. Die nächste Karte wird gastfreundlicher.",
      "Macht nichts. Wirklich.",
      "Knapp daneben. Ich lächle.",
      "Das Blatt ist heute eigen. Wir nicht.",
      "Ein Stich ist noch kein Abend.",
      "Schade. Wir legen weiter.",
      "Alles gut bei uns.",
      "Ich atme durch.",
      "Kein Grund zur Eile.",
      "Wir lachen kurz und machen weiter.",
      "Die nächste Runde tröstet.",
      "Ich nehme das leicht."
    ],
    "banter": [
      "Alles gut bei dir? Bei mir schon.",
      "Schön, dass wir zusammen sitzen.",
      "Noch eine Runde? Ich bin dabei.",
      "Der Tisch darf gemütlich sein.",
      "Ich passe auf, dass niemand außen vor bleibt.",
      "Zwischendurch einfach lächeln.",
      "Fair bleiben. Das mag ich.",
      "Ich freue mich, dass ihr da seid.",
      "Wer hat Lust auf die nächste?",
      "Zusammen ist es am schönsten.",
      "Ein ruhiger Moment tut gut.",
      "Ich bin gern euer Gastgeber am Tisch."
    ]
  },
  "ruediger": {
    "greetings": [
      "Guten Abend. Die Karten liegen bereit, der Platz auch.",
      "Willkommen. Schön, dass du da bist.",
      "Guten Abend zusammen. Wir spielen aufmerksam.",
      "Setz dich. Es ist alles in Ordnung.",
      "Hallo. Ich freue mich, in aller Ruhe.",
      "Willkommen am Tisch. Heute bleibt es freundlich.",
      "Da bist du ja. Gut so.",
      "Guten Abend. Ich habe den Stuhl schon zurechtgerückt.",
      "Schön dich zu sehen. Das sage ich selten so offen, aber es stimmt.",
      "Komm nur. Wir haben Zeit.",
      "Ich nicke dir zu. Herzlich.",
      "Guten Abend. Dann können wir beginnen."
    ],
    "bidding": [
      "Ich gehe mit. Ordnung ist auch ein freundlicher Zug.",
      "Ich passe. Das ist die saubere Entscheidung.",
      "So, ich sage an. Klar und ohne Umschweife.",
      "Nicht zu hoch. Das Blatt setzt die Grenze.",
      "Ich lasse euch vor. Gern.",
      "Die Ansage steht. Nun spielen wir korrekt und nett.",
      "Ich halte mit. Mal sehen.",
      "Ein Schritt genügt.",
      "Ich spiele. Und ich nehme euch fair mit.",
      "Wir bleiben bei der Ansage und bei der guten Laune.",
      "Ansage ist raus. Ich prüfe nichts weiter, ich lächle.",
      "Maß ist hier die richtige Regel."
    ],
    "winning": [
      "Ergebnis festgestellt. Ich freue mich trotzdem ganz normal.",
      "Gewonnen. Danke für das faire Spiel.",
      "Ein sauberer Punkt.",
      "Schön für uns. Die nächste Runde bleibt offen.",
      "Das stimmt, und es ist schön.",
      "Ich nicke. Das war unseres.",
      "Gut gemacht.",
      "So soll es sein. Klar und freundlich.",
      "Weiter so.",
      "Das gönne ich uns.",
      "Respekt an den Tisch.",
      "Ein Punkt ohne Fußnote. Gut."
    ],
    "losing": [
      "Zur Kenntnis genommen, mit Respekt.",
      "Ihr habt korrekt und schön gespielt.",
      "Der Punkt gehört euch.",
      "Alles in Ordnung. Nächste Runde.",
      "Ich gratuliere, ganz sachlich und ehrlich.",
      "Kein Grund zur Aufregung.",
      "Ihr habt das ordentlich gemacht.",
      "Ich bleibe freundlich.",
      "Das war euer Spiel.",
      "Der Abend bleibt gut.",
      "Ich freue mich für euch.",
      "Weiter geht es, sauber wie vorher."
    ],
    "goodMove": [
      "Der Stich ist korrekt und gehört uns. Danke.",
      "Genau die Karte. Sauber gelegt.",
      "Das war aufmerksam.",
      "Ich habe es gesehen. Gut.",
      "Zusammen stimmt die Rechnung, und die Stimmung.",
      "Fein. Weiter so.",
      "Das war ein sauberer Zug.",
      "Die Augen nehme ich ordnungsgemäß und gerne.",
      "Klasse Zug.",
      "So spielt man fair.",
      "Ich nicke dir zu.",
      "Das war die richtige Wahl."
    ],
    "badLuck": [
      "Knapp daneben. Das kommt vor.",
      "Pech. Die nächste Karte ist offen.",
      "Macht nichts. Ich bleibe ruhig.",
      "Das Blatt folgt heute einer anderen Ordnung.",
      "Ein Stich ist noch kein Ergebnis.",
      "Schade. Wir spielen weiter.",
      "Alles in Ordnung.",
      "Ich atme durch.",
      "Kein Grund zur Eile.",
      "Wir lächeln und legen die nächste.",
      "Die nächste Runde bleibt sauber.",
      "Ich nehme das ohne Ärger."
    ],
    "banter": [
      "Einen Moment der Ruhe. Dann die nächste Karte.",
      "Schön, dass wir vollständig sind.",
      "Noch eine Runde? Ich bin einverstanden, und ich freue mich.",
      "Ein geordneter Tisch ist ein freundlicher Tisch.",
      "Fair bleiben. Das ist die ganze Regel, die ich heute brauche.",
      "Zwischendurch darf man lächeln.",
      "Der Abend passt.",
      "Ich sage nicht viel. Das ist schon Zustimmung.",
      "Wer mag die nächste?",
      "Zusammen spielt es sich klarer.",
      "Ich bin gern hier.",
      "Wir haben Zeit. Das ist gut."
    ]
  },
  "chantal": {
    "greetings": [
      "Hömma, da biste ja. Rück den Stuhl ran, dat wird freundlich.",
      "Moin. Schön, dass de da bist.",
      "Willkommen. Ich hab schon gelacht.",
      "Hallo zusammen. Der Tisch ist frei.",
      "Komm ran. Ich freu mich.",
      "Na, endlich. Herzlich, ey.",
      "Guten Abend. Heute bleibt es laut und nett.",
      "Setz dich. Der Platz ist deiner.",
      "Schön dich zu sehen. Ehrlich.",
      "Hömma, willkommen in der Runde.",
      "Da bist du ja. Gut so.",
      "Hallo. Die Karten können kommen."
    ],
    "bidding": [
      "Los, ich geh ein Stück mit. Ganz ohne Mauerei.",
      "Ich pass. Lieber lachen als zu hoch.",
      "So, ich sag an. Klar und fröhlich.",
      "Ein bisschen höher, dann reicht et.",
      "Ich lass euch vor. Gern, ne.",
      "Die Ansage steht. Nun wird gespielt, nett.",
      "Ich halt mit. Mal sehen.",
      "Nicht wild. Maß kann ich auch.",
      "Ich spiel. Und ich nehm euch mit.",
      "Dat ist meine Ansage. Ihr dürft grinsen.",
      "Ansage ist raus. Bleibt locker.",
      "Wir sagen es kurz und freundlich."
    ],
    "winning": [
      "Hah. Dat hat gesessen, und ich freu mich mit euch.",
      "Gewonnen. Nächste Runde bist du dran.",
      "Punkt für uns. Ihr wart trotzdem stark.",
      "Schön. Das war laut und fair.",
      "So mag ich dat.",
      "Danke fürs Mitspielen.",
      "Ich lache, aber nicht über euch.",
      "Sauber. Weiter so.",
      "Ein Punkt mit Schwung.",
      "Das gönn ich uns.",
      "Bravo an den Tisch.",
      "Fein gemacht, ey."
    ],
    "losing": [
      "Och. War halt nicht meiner. Trotzdem schön hier.",
      "Respekt. Der Punkt ist euer.",
      "Ihr habt dat gut gemacht.",
      "Ich gönn es euch. Ehrlich.",
      "Kein Schmollen. Versprochen.",
      "Nächstes Mal, ne. Heute ihr.",
      "Alles easy, und alles freundlich.",
      "Schön gespielt.",
      "Ich nick. Dat war eures.",
      "Der Abend bleibt trotzdem richtig schön.",
      "Wir machen weiter.",
      "Ich freu mich für euch."
    ],
    "goodMove": [
      "Ey, der Stich ist unserer. Nicht schmollen, mitfreuen.",
      "Genau die Karte. Stark.",
      "Danke. Dat hat gesessen.",
      "Sauber gelegt.",
      "So spielt man zusammen.",
      "Ich habs gesehen. Gut.",
      "Klasse, ne.",
      "Die Augen nehm ich gerne.",
      "Fein. Weiter so.",
      "Zusammen sind wir laut und klug.",
      "Respekt für den Zug.",
      "Dat merke ich mir freundlich."
    ],
    "badLuck": [
      "Och. Die Karte wollte nicht, ich schon, auf die nächste.",
      "Pech. Macht nichts.",
      "Knapp daneben. Ich grinse.",
      "Dat Blatt ist heute frech.",
      "Ein Stich ist noch kein Spiel.",
      "Schade. Wir legen weiter.",
      "Alles easy.",
      "Ich atme durch, ganz kurz.",
      "Kein Drama, ne.",
      "Die nächste wird besser.",
      "Wir lachen und machen weiter.",
      "Ich bleib guter Dinge."
    ],
    "banter": [
      "Hömma, schön dass wir sitzen.",
      "Noch eine Runde? Ich bin dabei.",
      "Der Tisch darf laut sein, aber nett.",
      "Ich mag euch. Sag ich einfach.",
      "Fair bleiben, ey.",
      "Zwischendurch einmal grinsen.",
      "Der Abend passt.",
      "Wer hat Lust auf die nächste?",
      "Zusammen ist es am besten.",
      "Ich halt auch mal die Klappe. Selten, aber herzlich.",
      "Lasst uns Spaß haben.",
      "Ich bin gern hier."
    ]
  }
};
  var REPLIES = {
  "horst": {
    "greet": [
      "Ja ja, hallo. Schön, dass de da bist.",
      "N Abend. Nu spiel wa.",
      "Moin. Ick freu mir leise.",
      "Hallo. Setz dich erst mal.",
      "Na du. Der Tisch hat auf dich gewartet.",
      "Guten Abend. Ick bin gut drauf, ehrlich.",
      "Willkommen. Mehr sag ick nich, aber es gilt.",
      "Hallo. Berlin grüßt."
    ],
    "luck": [
      "Glück? Det war ooch ein bisschen Können.",
      "Wenn de Glück hast, freu ick mir mit.",
      "Na jut, diesmal lächelt et dich an.",
      "Glück is nett. Gönn dir det.",
      "Ick nenn et eine freundliche Karte.",
      "Passt. Genieß et.",
      "Schön für dich. Wirklich.",
      "Dusel? Ick sag: gut gespielt."
    ],
    "praise": [
      "Na, danke. Det hör ick gern.",
      "Übertreib nich, aber danke.",
      "Schön, dass du et merkst.",
      "Ick werd fast verlegen. Fast.",
      "Danke. Ick geb mir Mühe.",
      "Das war nett gesagt.",
      "Ick nick dir zu.",
      "Weiter so, dann lob ick zurück."
    ],
    "anger": [
      "Nu ganz ruhig. Is doch bloß ein Spiel, und ein schönes.",
      "Kopp hoch. Ick bin ja da.",
      "Meckern darf ick, du darfst lachen.",
      "Atme ma durch. Die nächste Karte kommt.",
      "Alles gut. Wirklich.",
      "Wir bleiben freundlich, wa?",
      "Ick reg mich nich uff. Du ooch nich.",
      "Ein Stich is keen Weltuntergang."
    ],
    "drink": [
      "N Wasser wär jetze jut. Oder einfach eine Pause.",
      "Ick denk an eine Molle und spiel weiter.",
      "Prost, in Gedanken.",
      "Durst? Dann kurz durchatmen.",
      "Nach der Runde, vielleicht.",
      "Ick bleib hier am Tisch. Det reicht mir.",
      "Schön wär ein Kaffee. Erst die Karte.",
      "Wir heben nix, wir nicken nur."
    ],
    "rules": [
      "Bedienen musste. Det is det Wichtigste, und es is fair.",
      "Schalt die Tipps ein, dann zeigt der Tisch den Weg.",
      "Erst die Farbe, dann der Rest. Ganz ruhig.",
      "Frag nur. Ick erklär et ohne Gemecker.",
      "Die Regeln sind unser gemeinsamer Tisch.",
      "Keine Hektik. Eine Karte nach der andern.",
      "Ick helf dir gern, ehrlich.",
      "Schau auf die grünen Karten, die darfst du."
    ],
    "thanks": [
      "Jaja, schon jut. Gern geschehen.",
      "Danke zurück.",
      "Nich der Rede wert.",
      "Gern, Kollege.",
      "Ick hab det gern gemacht.",
      "Passt. Immer.",
      "Schön, dass du danke sagst.",
      "Na bitte. Weiter."
    ],
    "bye": [
      "Na denn, tschüss. Komm wieder.",
      "Schlaf gut. Der Tisch bleibt freundlich.",
      "Bis bald. Ick freu mir schon.",
      "Machs gut.",
      "Tschüss. War schön mit dir.",
      "Gute Nacht. Ohne Meckern, ausnahmsweise.",
      "Bis zum nächsten Spiel.",
      "Geh ruhig. Ick halt den Platz warm."
    ],
    "default": [
      "Wat liegt an? Ick hör zu.",
      "Red nur, ick spiel dabei freundlich.",
      "Aha. Erzähl weiter.",
      "Ick bin ganz Ohr.",
      "Na jut. Und nun die Karte.",
      "Det klingt nett.",
      "Ick nicke. Mehr brauch ick nich.",
      "Schön, dass du was sagst."
    ]
  },
  "margarethe": {
    "greet": [
      "Guten Abend, Schätzchen. Wie schön.",
      "Hallo. Hast Du es bequem?",
      "Willkommen. Ich habe schon gelächelt.",
      "Guten Abend. Setz Dich zu mir.",
      "Schön, dass Du da bist.",
      "Herzlich willkommen am Tisch.",
      "Na, da bist Du ja.",
      "Einen schönen Abend, wirklich."
    ],
    "luck": [
      "Glück steht Dir, Schätzchen.",
      "Ach, das gönne ich Dir.",
      "Eine freundliche Karte, mehr nicht, und doch schön.",
      "Genieß es. Ich lächle mit.",
      "Das war hübsch für Dich.",
      "Glück ist heute auf Deiner Seite. Gut so.",
      "Ich nicke. Das steht Dir.",
      "Bravo, auch wenn der Zufall mitgespielt hat."
    ],
    "praise": [
      "Oh, wie charmant. Danke.",
      "Du bist zu lieb, und ich höre es gern.",
      "Das freut mich, Schätzchen.",
      "Ein Kompliment am Tisch. Wunderbar.",
      "Danke. Man tut, was man kann.",
      "Wie aufmerksam von Dir.",
      "Ich werde ein klein wenig rot. Nur innerlich.",
      "Das sage ich Dir auch: gut gemacht."
    ],
    "anger": [
      "Aber ganz ruhig. Wir sind in guter Gesellschaft.",
      "Contenance, Schätzchen, und ein Lächeln.",
      "Nicht schlimm. Die nächste Karte kommt.",
      "Ich bleibe heiter. Du auch, ja?",
      "Ein Spiel, kein Sturm.",
      "Atme durch. Ich sitze ja hier.",
      "Wir bleiben charmant.",
      "Kopf hoch. Wirklich."
    ],
    "drink": [
      "Ein Gläschen in Gedanken, gut gekühlt.",
      "Für mich erst die Karte, dann vielleicht ein Sekt.",
      "Prost, ganz dezent.",
      "Durst? Dann eine kleine Pause.",
      "Ich hebe nichts, ich nicke nur.",
      "Nach der Runde, Schätzchen.",
      "Ein Kaffee wäre auch hübsch. Später.",
      "Wir bleiben am Tisch. Das ist mir Lieblingstrunk genug."
    ],
    "rules": [
      "Schalte die Hinweise ein, dann zeigt Dir der Tisch den Weg.",
      "Erst bedienen, dann stechen. Ganz ruhig.",
      "Frag nur. Ich erkläre es gern.",
      "Die Regeln sind unser gemeinsamer Anstand.",
      "Keine Eile. Eine Karte nach der anderen.",
      "Ich helfe Dir, Schätzchen.",
      "Schau, was erlaubt ist. Der Tisch sagt es freundlich.",
      "So schwer ist es nicht. Ich bleibe bei Dir."
    ],
    "thanks": [
      "Gern geschehen, Schätzchen.",
      "Aber gerne.",
      "Das war mir eine Freude.",
      "Nichts zu danken.",
      "Immer, mein Lieber.",
      "Wie nett, dass Du danke sagst.",
      "Gern. Wirklich.",
      "Bitte schön."
    ],
    "bye": [
      "Schon? Gute Nacht, Schätzchen.",
      "Schlaf gut. Es war reizend.",
      "Bis bald. Ich freue mich.",
      "Gute Nacht. Komm wieder.",
      "Tschüss. Der Tisch vermisst Dich schon.",
      "Geh nur. Ich halte den Platz hübsch.",
      "Auf Wiedersehen.",
      "Eine gute Nacht, von Herzen."
    ],
    "default": [
      "Wie bitte, Schätzchen? Ich höre.",
      "Erzähl nur. Ich spiele dabei.",
      "Ach, wie nett.",
      "Ich bin ganz Ohr.",
      "Interessant. Und nun die Karte.",
      "Hm, das gefällt mir.",
      "Sprich nur. Ich lächle.",
      "Schön, dass Du etwas sagst."
    ]
  },
  "urs": {
    "greet": [
      "Grüezi. Schön, dass du da bist.",
      "Willkommen. Setz dich.",
      "Hoi. Wir haben Zeit.",
      "Guten Abend. Ruhig und herzlich.",
      "Da bist du ja. Gut.",
      "Grüezi miteinand.",
      "Schön dich zu sehen.",
      "Komm nur. Der Platz ist frei."
    ],
    "luck": [
      "Guet für dich. Ich gönne es.",
      "Das war eine freundliche Karte.",
      "Schön. Genieß es.",
      "Glück, und trotzdem sauber.",
      "Ich nicke. Das steht dir.",
      "Passt. Wirklich.",
      "Freut mich für dich.",
      "So ist es recht."
    ],
    "praise": [
      "Danke. Das höre ich gern.",
      "Guet gesagt.",
      "Ich werde still verlegen. Nur kurz.",
      "Danke dir.",
      "Schön, dass du es merkst.",
      "Das ist nett.",
      "Ich nicke zurück.",
      "Gern geschehen, und danke auch."
    ],
    "anger": [
      "Ganz ruhig. Es ist nur ein Spiel.",
      "Nid schlimm. Die nächste Karte kommt.",
      "Wir bleiben freundlich.",
      "Atme durch.",
      "Ich sitze hier. Alles gut.",
      "Kein Grund zur Eile.",
      "Kopf hoch.",
      "Ein Stich, nicht mehr."
    ],
    "drink": [
      "Ein Wasser in Gedanken. Erst die Karte.",
      "Prost, ganz leise.",
      "Nach der Runde vielleicht.",
      "Durst? Dann eine kleine Pause.",
      "Ich bleibe am Tisch. Das genügt.",
      "Ein Kaffee wäre guet. Später.",
      "Wir nicken nur.",
      "Keine Hast."
    ],
    "rules": [
      "Bedienen, ganz ruhig. Das ist der Kern.",
      "Schalt die Hinweise ein. Der Tisch hilft.",
      "Frag nur. Ich erkläre es ohne Hast.",
      "Eine Karte nach der anderen.",
      "Die Regeln halten uns freundlich.",
      "Ich helfe dir gern.",
      "Schau, was erlaubt ist.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Gere. Wirklich.",
      "Gern geschehen.",
      "Nichts zu danken.",
      "Passt.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Bitte.",
      "Guet so."
    ],
    "bye": [
      "Bis bald. Es war schön.",
      "Gute Nacht.",
      "Tschüss. Komm wieder.",
      "Schlaf gut.",
      "Ich freue mich auf das nächste Mal.",
      "Geh ruhig.",
      "Auf Wiedersehen.",
      "Der Platz bleibt dir freundlich."
    ],
    "default": [
      "Ich höre.",
      "Erzähl nur.",
      "Guet.",
      "Ich bin da.",
      "Und nun die Karte, ganz ruhig.",
      "Das klingt nett.",
      "Ich nicke.",
      "Schön, dass du sprichst."
    ]
  },
  "vreni": {
    "greet": [
      "Hoi. Schön, dass du da bist.",
      "Hallo. Jetzt kann es losgehen.",
      "Willkommen. Ich freue mich.",
      "Hoi zusammen.",
      "Da bist du ja. Gut, oder?",
      "Guten Abend. Herzlich.",
      "Setz dich. Der Tisch lacht schon.",
      "Schön dich zu sehen."
    ],
    "luck": [
      "Gönn dir das. Ich lache mit.",
      "Glück? Auch ein bisschen flink gespielt.",
      "Schön für dich.",
      "Das war eine freche, nette Karte.",
      "Passt. Genieß es.",
      "Ich nicke. Gut so.",
      "Freut mich.",
      "Weiter so, oder?"
    ],
    "praise": [
      "Danke. Das hör ich gern.",
      "Oh, nett.",
      "Ich werde fast verlegen. Fast.",
      "Danke dir.",
      "Schön gesagt.",
      "Das freut mich.",
      "Ich grinse zurück.",
      "Gern, und danke auch."
    ],
    "anger": [
      "Nöd hängen lah. Wirklich.",
      "Ganz ruhig. Nächste Karte.",
      "Ich bin ja da.",
      "Wir bleiben lustig.",
      "Atme durch.",
      "Ein Stich, nicht der Abend.",
      "Kopf hoch.",
      "Alles gut, oder?"
    ],
    "drink": [
      "Prost, in Gedanken.",
      "Erst die Karte, dann vielleicht etwas.",
      "Durst? Kurze Pause.",
      "Ich denk an etwas Kühles und spiele weiter.",
      "Nach der Runde.",
      "Wir bleiben sitzen. Das reicht.",
      "Ein Kaffee wäre auch lustig. Später.",
      "Ich nick nur."
    ],
    "rules": [
      "Bedienen, und dann darfst du flink sein.",
      "Schalt die Tipps ein. Der Tisch zeigt es.",
      "Frag nur. Ich erklär es gern.",
      "Eine Karte nach der andern.",
      "Fair bleiben, das ist die Regel, die ich mag.",
      "Ich helf dir.",
      "Schau auf die erlaubten Karten.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Gere.",
      "Gern geschehen.",
      "Nichts zu danken.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Bitte.",
      "Passt.",
      "Gern, oder?"
    ],
    "bye": [
      "Tschüss. Nöd trödele, aber schlaf gut.",
      "Bis bald.",
      "Gute Nacht.",
      "Komm wieder. Ich freu mich.",
      "Machs gut.",
      "Hoi und tschüss.",
      "Der Tisch vermisst dich schon.",
      "Bis zum nächsten Spiel."
    ],
    "default": [
      "Oder? Ich hör zu.",
      "Erzähl.",
      "Aha. Nett.",
      "Ich bin da.",
      "Und nun die Karte.",
      "Das klingt gut.",
      "Ich grinse.",
      "Schön, dass du was sagst."
    ]
  },
  "sepp": {
    "greet": [
      "Servus. Schön, dass du da bist.",
      "Guten Abend. Setz di.",
      "Grüß dich.",
      "Willkommen.",
      "Da bist du ja. Gut.",
      "Servus miteinand.",
      "Der Platz ist frei.",
      "Schön dich zu sehen."
    ],
    "luck": [
      "Basst. Das gönn ich dir.",
      "Eine freundliche Karte.",
      "Schön für dich.",
      "Genieß es.",
      "Ich nick. Gut so.",
      "Glück, und sauber dazu.",
      "Freut mich.",
      "Passt schon."
    ],
    "praise": [
      "Danke. Das hör ich gern.",
      "Basst. Nett gesagt.",
      "Ich werd still verlegen.",
      "Danke dir.",
      "Schön, dass du es merkst.",
      "Das freut mich.",
      "Ich nick zurück.",
      "Gern."
    ],
    "anger": [
      "Ganz ruhig. Es ist nur ein Spiel.",
      "Kopf hoch.",
      "Die nächste Karte kommt.",
      "Ich bin da.",
      "Alles gut.",
      "Wir bleiben freundlich.",
      "Kein Grant.",
      "Ein Stich, nicht mehr."
    ],
    "drink": [
      "Prost, in Gedanken.",
      "Erst die Karte.",
      "Nach der Runde vielleicht ein Kaffee.",
      "Durst? Kurze Pause.",
      "Ich bleib am Tisch.",
      "Wir nicken nur.",
      "Schön wär etwas Kühles. Später.",
      "Keine Hast."
    ],
    "rules": [
      "Bedienen, ganz ruhig.",
      "Schalt die Hinweise ein.",
      "Frag nur. Ich erklär es gern.",
      "Eine Karte nach der andern.",
      "Fair bleiben.",
      "Ich helf dir.",
      "Schau, was erlaubt ist.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Basst scho. Gern.",
      "Danke zurück.",
      "Nichts zu danken.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Bitte.",
      "Passt.",
      "Gern geschehen."
    ],
    "bye": [
      "Pfiat di. Komm wieder.",
      "Gute Nacht.",
      "Bis bald.",
      "Schlaf gut.",
      "Servus. Es war schön.",
      "Machs gut.",
      "Der Platz bleibt dir.",
      "Bis zum nächsten Spiel."
    ],
    "default": [
      "Sag amoi. Ich hör zu.",
      "Basst.",
      "Erzähl nur.",
      "Ich bin da.",
      "Und nun die Karte.",
      "Das klingt nett.",
      "Ich nick.",
      "Schön, dass du sprichst."
    ]
  },
  "hilde": {
    "greet": [
      "Na, Kind. Schön, dass du da bist.",
      "Guten Abend. Setz dich.",
      "Willkommen.",
      "Hallo. Der Tisch ist ruhig.",
      "Da bist du ja.",
      "Ich freue mich.",
      "Komm nur.",
      "Schön dich zu sehen."
    ],
    "luck": [
      "Das gönne ich dir, Kind.",
      "Eine freundliche Karte.",
      "Schön für dich.",
      "Genieß es.",
      "Ich nicke. Gut so.",
      "Freut mich.",
      "So ist es recht.",
      "Glück, und du hast es lieb genommen."
    ],
    "praise": [
      "Danke, Kind. Das höre ich gern.",
      "Wie nett.",
      "Ich werde ein bisschen verlegen.",
      "Danke dir.",
      "Schön gesagt.",
      "Das freut mich.",
      "Ich nicke zurück.",
      "Gern."
    ],
    "anger": [
      "Nicht ärgern. Es ist nur ein Spiel.",
      "Kopf hoch, Kind.",
      "Die nächste Karte kommt.",
      "Ich bin ja da.",
      "Alles gut.",
      "Wir bleiben sanft.",
      "Atme durch.",
      "Ein Stich, nicht der Abend."
    ],
    "drink": [
      "Ein Kaffee in Gedanken. Erst die Karte.",
      "Prost, ganz leise.",
      "Nach der Runde vielleicht.",
      "Durst? Eine kleine Pause.",
      "Ich bleibe am Tisch.",
      "Wir nicken nur.",
      "Später, Kind.",
      "Keine Hast."
    ],
    "rules": [
      "Ganz ruhig. Erst bedienen.",
      "Schalt die Hinweise ein. Der Tisch hilft.",
      "Frag nur. Ich erkläre es gern.",
      "Eine Karte nach der anderen.",
      "Die Regeln sind unser Frieden.",
      "Ich helfe dir.",
      "Schau, was erlaubt ist.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Gern, mein Kind.",
      "Aber gerne.",
      "Nichts zu danken.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Bitte.",
      "Das war mir eine Freude.",
      "Gern geschehen."
    ],
    "bye": [
      "Schlaf gut. Komm wieder.",
      "Gute Nacht, Kind.",
      "Bis bald.",
      "Es war schön.",
      "Geh ruhig.",
      "Ich halte den Platz warm.",
      "Auf Wiedersehen.",
      "Bis zum nächsten Spiel."
    ],
    "default": [
      "So, so. Ich höre.",
      "Erzähl nur, Kind.",
      "Ich bin da.",
      "Wie nett.",
      "Und nun die Karte.",
      "Das klingt freundlich.",
      "Ich nicke.",
      "Schön, dass du etwas sagst."
    ]
  },
  "lena": {
    "greet": [
      "Hallo. Schön, dass du da bist.",
      "Moin. Ich bin dabei.",
      "Willkommen.",
      "Hallo zusammen.",
      "Da bist du ja. Gut.",
      "Guten Abend.",
      "Setz dich. Der Platz ist frei.",
      "Schön dich zu sehen."
    ],
    "luck": [
      "Gönn dir das.",
      "Das war auch ein bisschen klug.",
      "Schön für dich.",
      "Glück, fair angenommen.",
      "Ich nicke. Gut so.",
      "Freut mich.",
      "Passt.",
      "Weiter so."
    ],
    "praise": [
      "Danke. Das freut mich.",
      "Nett gesagt.",
      "Ich werde kurz verlegen.",
      "Danke dir.",
      "Schön, dass du es merkst.",
      "Respekt zurück.",
      "Ich grinse.",
      "Gern."
    ],
    "anger": [
      "Kopf hoch. Eine Karte macht noch kein Spiel.",
      "Ganz ruhig.",
      "Alles gut.",
      "Ich bin da.",
      "Nächster Zug.",
      "Wir bleiben fair.",
      "Atme durch.",
      "Kein Frust. Versprochen."
    ],
    "drink": [
      "Prost, in Gedanken.",
      "Erst die Karte.",
      "Nach der Runde vielleicht.",
      "Durst? Kurze Pause.",
      "Ich bleib am Tisch.",
      "Ein Wasser wäre gut. Später.",
      "Wir nicken nur.",
      "Keine Hetze."
    ],
    "rules": [
      "Fair bleiben, und bedienen.",
      "Schalt die Tipps ein.",
      "Frag nur. Ich erklär es gern.",
      "Eine Karte nach der anderen.",
      "Der Tisch zeigt, was erlaubt ist.",
      "Ich helfe dir.",
      "Ganz ruhig.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Gern.",
      "Danke zurück.",
      "Nichts zu danken.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Bitte.",
      "Passt.",
      "Gern geschehen."
    ],
    "bye": [
      "Bis dann.",
      "Schlaf gut.",
      "Komm wieder.",
      "Machs gut.",
      "Es war schön.",
      "Bis zum nächsten Spiel.",
      "Gute Nacht.",
      "Der Platz bleibt dir."
    ],
    "default": [
      "Alles gut. Ich hör zu.",
      "Erzähl.",
      "Echt? Nett.",
      "Ich bin da.",
      "Und nun die Karte.",
      "Das klingt fair.",
      "Ich nicke.",
      "Schön, dass du sprichst."
    ]
  },
  "jonas": {
    "greet": [
      "Guten Abend. Schön, dich zu sehen.",
      "Willkommen.",
      "Hallo. Setz dich.",
      "Da bist du ja.",
      "Guten Abend zusammen.",
      "Der Platz ist frei.",
      "Herzlich willkommen.",
      "Schön, dass du da bist."
    ],
    "luck": [
      "Das gönne ich dir.",
      "Eine freundliche Karte.",
      "Schön für dich.",
      "Gut so.",
      "Ich nicke.",
      "Freut mich.",
      "Passt.",
      "Genieß es, in Ruhe."
    ],
    "praise": [
      "Danke. Das höre ich gern.",
      "Wie aufmerksam.",
      "Ich werde still verlegen.",
      "Danke dir.",
      "Schön gesagt.",
      "Das freut mich.",
      "Ich nicke zurück.",
      "Gern."
    ],
    "anger": [
      "Kein Grund zur Aufregung.",
      "Ganz ruhig.",
      "Die nächste Karte ist offen.",
      "Ich bin da.",
      "Alles gut.",
      "Wir bleiben freundlich.",
      "Atme durch.",
      "Ein Zug, nicht mehr."
    ],
    "drink": [
      "Prost, ganz leise.",
      "Erst die Karte.",
      "Nach der Runde vielleicht.",
      "Durst? Eine kleine Pause.",
      "Ich bleibe am Tisch.",
      "Ein Wasser wäre gut. Später.",
      "Wir nicken nur.",
      "Keine Eile."
    ],
    "rules": [
      "Ruhig. Erst bedienen.",
      "Schalt die Hinweise ein.",
      "Frag nur. Ich erkläre es gern.",
      "Eine Karte nach der anderen.",
      "Die Regeln halten uns fair.",
      "Ich helfe dir.",
      "Schau, was erlaubt ist.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Gern geschehen.",
      "Bitte.",
      "Nichts zu danken.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Danke zurück.",
      "Passt.",
      "Das war mir recht."
    ],
    "bye": [
      "Schlaf gut.",
      "Bis bald.",
      "Gute Nacht.",
      "Komm wieder.",
      "Es war schön.",
      "Auf Wiedersehen.",
      "Machs gut.",
      "Der Platz bleibt dir freundlich."
    ],
    "default": [
      "Verstehe. Ich höre.",
      "Erzähl nur.",
      "Interessant, und freundlich.",
      "Ich bin da.",
      "Nach dir die Karte, wenn du magst.",
      "Das klingt gut.",
      "Ich nicke.",
      "Schön, dass du sprichst."
    ]
  },
  "oemer": {
    "greet": [
      "Willkommen. Setz dich zu uns.",
      "Guten Abend. Schön, dass du da bist.",
      "Hallo. Der Platz ist frei.",
      "Komm rein.",
      "Da bist du ja.",
      "Herzlich willkommen.",
      "Schön dich zu sehen.",
      "Guten Abend zusammen."
    ],
    "luck": [
      "Schön für dich. Ich gönne es.",
      "Eine freundliche Karte.",
      "Genieß es.",
      "Gut so.",
      "Ich lächle mit.",
      "Freut mich.",
      "Passt.",
      "Das steht dir."
    ],
    "praise": [
      "Danke. Das freut mich.",
      "Wie nett.",
      "Ich werde ein bisschen verlegen.",
      "Danke dir.",
      "Schön gesagt.",
      "Gern zurück.",
      "Ich nicke.",
      "Das höre ich gern."
    ],
    "anger": [
      "Kopf hoch. Hier gewinnt die Runde, nicht der Ärger.",
      "Ganz ruhig.",
      "Alles gut.",
      "Ich bin da.",
      "Die nächste Karte kommt.",
      "Wir bleiben herzlich.",
      "Atme durch.",
      "Ein Stich, nicht der Abend."
    ],
    "drink": [
      "Tee in Gedanken. Erst die Karte.",
      "Prost, ganz freundlich.",
      "Nach der Runde vielleicht.",
      "Durst? Eine kleine Pause.",
      "Ich bleibe am Tisch.",
      "Später gern.",
      "Wir nicken nur.",
      "Keine Hast."
    ],
    "rules": [
      "Ganz ruhig. Erst bedienen.",
      "Schalt die Hinweise ein.",
      "Frag nur. Ich erkläre es gern.",
      "Eine Karte nach der anderen.",
      "Fair bleiben, das ist Gastfreundschaft.",
      "Ich helfe dir.",
      "Schau, was erlaubt ist.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Immer gern.",
      "Bitte.",
      "Nichts zu danken.",
      "Gern geschehen.",
      "Schön, dass du danke sagst.",
      "Danke zurück.",
      "Passt.",
      "Das war mir eine Freude."
    ],
    "bye": [
      "Komm gut heim.",
      "Gute Nacht.",
      "Bis bald.",
      "Es war schön.",
      "Schlaf gut.",
      "Der Platz bleibt dir.",
      "Auf Wiedersehen.",
      "Bis zum nächsten Spiel."
    ],
    "default": [
      "Erzähl. Ich höre.",
      "Gern.",
      "Alles gut.",
      "Ich bin da.",
      "Und nun die Karte.",
      "Das klingt freundlich.",
      "Ich nicke.",
      "Schön, dass du sprichst."
    ]
  },
  "ruediger": {
    "greet": [
      "Guten Abend. Bitte, nimm Platz.",
      "Willkommen. Schön, dass du da bist.",
      "Hallo. Alles ist bereit.",
      "Guten Abend zusammen.",
      "Da bist du ja.",
      "Herzlich, in aller Ordnung.",
      "Setz dich.",
      "Schön dich zu sehen."
    ],
    "luck": [
      "Zur Kenntnis: das steht dir gut.",
      "Eine freundliche Karte.",
      "Ich gönne es dir.",
      "Gut so.",
      "Sauber, und ein wenig Glück. Beides schön.",
      "Freut mich.",
      "Passt.",
      "Ich nicke."
    ],
    "praise": [
      "Danke. Das ist korrekt und nett.",
      "Ich höre das gern.",
      "Wie aufmerksam.",
      "Danke dir.",
      "Schön gesagt.",
      "Das freut mich.",
      "Ich nicke zurück.",
      "Gern."
    ],
    "anger": [
      "Kein Grund zur Aufregung. Der nächste Zug ist offen.",
      "Ganz ruhig.",
      "Alles in Ordnung.",
      "Ich bin da.",
      "Wir bleiben sachlich und freundlich.",
      "Atme durch.",
      "Ein Stich, nicht mehr.",
      "Kopf hoch."
    ],
    "drink": [
      "Prost, ganz dezent.",
      "Erst die Karte.",
      "Nach der Runde vielleicht.",
      "Durst? Eine kleine Pause.",
      "Ich bleibe am Tisch.",
      "Ein Wasser wäre ordentlich. Später.",
      "Wir nicken nur.",
      "Keine Eile."
    ],
    "rules": [
      "Die Regel ist freundlich, wenn wir sie teilen.",
      "Schalt die Hinweise ein.",
      "Frag nur. Ich erkläre es genau und gern.",
      "Eine Karte nach der anderen.",
      "Erst bedienen.",
      "Ich helfe dir.",
      "Schau, was zulässig ist.",
      "So schwer ist es nicht."
    ],
    "thanks": [
      "Gern. Das war korrekt.",
      "Bitte.",
      "Nichts zu danken.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Danke zurück.",
      "Passt.",
      "Gern geschehen."
    ],
    "bye": [
      "Auf Wiedersehen.",
      "Gute Nacht.",
      "Bis bald.",
      "Es war schön.",
      "Schlaf gut.",
      "Komm wieder.",
      "Der Platz bleibt dir.",
      "Bis zum nächsten Spiel."
    ],
    "default": [
      "Einen Moment. Ich höre.",
      "Erzähl nur.",
      "Verstanden.",
      "Ich bin da.",
      "Und nun die Karte.",
      "Das klingt gut.",
      "Ich nicke.",
      "Schön, dass du sprichst."
    ]
  },
  "chantal": {
    "greet": [
      "Hömma, moin. Setz dich.",
      "Hallo. Schön, dass de da bist.",
      "Willkommen.",
      "Na, da biste ja.",
      "Guten Abend. Herzlich, ey.",
      "Der Platz ist frei.",
      "Komm ran.",
      "Schön dich zu sehen."
    ],
    "luck": [
      "Gönn dir dat.",
      "Schön für dich.",
      "Glück, und du hast es gut mitgenommen.",
      "Ich lach mit.",
      "Passt.",
      "Freut mich.",
      "Gut so, ne.",
      "Weiter so."
    ],
    "praise": [
      "Danke. Dat hör ich gern.",
      "Nett, ey.",
      "Ich werd kurz verlegen.",
      "Danke dir.",
      "Schön gesagt.",
      "Das freut mich.",
      "Ich grins zurück.",
      "Gern."
    ],
    "anger": [
      "Kopf hoch, ne. Wir sind eine Runde.",
      "Ganz ruhig.",
      "Alles easy, und alles freundlich.",
      "Ich bin da.",
      "Nächste Karte.",
      "Nicht schmollen.",
      "Atme durch.",
      "Ein Stich, nicht der Abend."
    ],
    "drink": [
      "Prost, in Gedanken.",
      "Erst die Karte.",
      "Nach der Runde vielleicht.",
      "Durst? Kurze Pause.",
      "Ich bleib am Tisch.",
      "Etwas Kühles wäre schön. Später.",
      "Wir nicken nur.",
      "Keine Hetze."
    ],
    "rules": [
      "Ganz ruhig. Erst bedienen.",
      "Schalt die Tipps ein.",
      "Frag nur. Ich erklär et gern.",
      "Eine Karte nach der andern.",
      "Fair bleiben, hömma.",
      "Ich helf dir.",
      "Schau, was erlaubt ist.",
      "So schwer ist et nicht."
    ],
    "thanks": [
      "Schon gut, ne. Gern.",
      "Danke zurück.",
      "Nichts zu danken.",
      "Immer.",
      "Schön, dass du danke sagst.",
      "Bitte.",
      "Passt.",
      "Gern geschehen."
    ],
    "bye": [
      "Machs gut, ey.",
      "Bis bald.",
      "Schlaf gut.",
      "Komm wieder.",
      "Es war schön.",
      "Gute Nacht.",
      "Der Platz bleibt dir.",
      "Bis zum nächsten Spiel."
    ],
    "default": [
      "Wat denn? Ich hör zu.",
      "Erzähl.",
      "Hömma, nett.",
      "Ich bin da.",
      "Und nun die Karte.",
      "Dat klingt gut.",
      "Ich nick.",
      "Schön, dass du sprichst."
    ]
  }
};

  var SITUATION = {
    welcome: 'greetings', greet: 'greetings',
    gameStart: 'bidding', bid: 'bidding', bidHigh: 'bidding', passBid: 'bidding', declare: 'bidding',
    sauspiel: 'bidding', solo: 'bidding', wenz: 'bidding', schieben: 'bidding', marriage: 'bidding',
    close: 'bidding', schlag: 'bidding', bieten: 'bidding', gehen: 'bidding', ansage: 'bidding',
    trump: 'bidding', stoeck: 'bidding', re: 'bidding', kontra: 'bidding', retour: 'bidding', stoss: 'bidding',
    bock: 'bidding', ramsch: 'bidding', passedIn: 'bidding',
    selfWins: 'winning', humanWins: 'winning', roundWin: 'winning', sessionSelf: 'winning',
    sessionHuman: 'winning', sessionSelfWins: 'winning', sessionHumanWins: 'winning',
    sessionOtherWins: 'winning', schneider: 'winning', schwarz: 'winning', handWin: 'winning',
    matchWin: 'winning', win: 'winning', goOut: 'winning', canasta: 'winning', handRomme: 'winning',
    feuer: 'winning', thirty: 'winning', maumau: 'winning', mau: 'winning',
    selfLoses: 'losing', humanLoses: 'losing', roundLose: 'losing', overbid: 'losing',
    handLose: 'losing', matchLose: 'losing', lose: 'losing', throw: 'losing', stall: 'losing',
    bigTrick: 'goodMove', partnerSchmier: 'goodMove', trick: 'goodMove', meld: 'goodMove',
    layoff: 'goodMove', take: 'goodMove', takePile: 'goodMove', redThree: 'goodMove',
    exchange: 'goodMove', knock: 'goodMove', eleven: 'goodMove',
    weakPlay: 'badLuck', weakPlayKind: 'badLuck', draw: 'badLuck', penalty: 'badLuck',
    forgot: 'badLuck', seven: 'badLuck', eight: 'badLuck', swap: 'badLuck', swapAll: 'badLuck',
    block: 'badLuck', freeze: 'badLuck',
    thinking: 'banter', default: 'banter', encourage: 'banter', play: 'banter', wish: 'banter',
    partnerAsk: 'banter', answerYes: 'banter', answerNo: 'banter', schweinchen: 'banter'
  };

  /*
   * Kurze Reizworte. Die Zahl und der Spielname bleiben fest.
   * Der alte eine Satz steckt mit im Vorrat, damit die vorhandene Aufnahme
   * weiter passt, wenn genau dieser Satz gezogen wird.
   */
  var CALLS = {
    standard: {
      pass: [
        'Ich passe.',
        'Diesmal nicht.',
        'Ohne mich.',
        'Ich lasse es.',
        'Heute passe ich.',
        'Ich warte lieber.',
        'Passe. Ganz in Ruhe.',
        'Ich steige aus.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Gern, weiter.',
        'Ich bleibe.',
        'Ja, in Ruhe.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    horst: {
      pass: [
        'Weg.',
        'Ick passe.',
        'Nich mit dem Blatt.',
        'Diesmal lass ick.',
        'Passe. Ehrlich.',
        'Ohne mich.',
        'Ick steig aus.',
        'Weg, diesmal.'
      ],
      hold: [
        'Jo.',
        'Ick halte.',
        'Ja, ick bleib.',
        'Mitgegangen.',
        'Ick bleib dabei.',
        'Jo, weiter.',
        'Ick halt mit.',
        'Na jut, ick halte.'
      ],
      open: [
        'Na jut, ick spiele.',
        'Denn spiel ick.',
        'Ick nehm das Spiel.',
        'Los, ick spiele.',
        'Det Spiel is meins.',
        'Ick fang an.',
        'Na schön, ick spiele.',
        'Denn mal los.'
      ]
    },
    margarethe: {
      pass: [
        'Ich passe.',
        'Diesmal nicht, Schätzchen.',
        'Ich halte mich zurück.',
        'Ohne mich, diesmal.',
        'Ich lasse Euch den Vortritt.',
        'Passe. Mit Haltung.',
        'Ich steige aus.',
        'Heute passe ich.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Aber gern.',
        'Ich bleibe.',
        'Ja, weiter.'
      ],
      open: [
        'Dann spiele ich eben.',
        'Ich spiele.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    urs: {
      pass: [
        'Ich passe.',
        'Diesmal nicht.',
        'Ich lasse es ruhig.',
        'Ohne mich, gelassen.',
        'Ich warte lieber.',
        'Passe. Ganz ruhig.',
        'Ich steige aus.',
        'Heute nicht, guet so.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Gern, weiter.',
        'Ich bleibe.',
        'Ja, in Ruhe.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    vreni: {
      pass: [
        'Ich passe.',
        'Diesmal nicht, oder?',
        'Ich lasse es.',
        'Ohne mich, diesmal.',
        'Lieber warten.',
        'Passe. Ganz locker.',
        'Ich steige aus.',
        'Heute nicht.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Aber gern.',
        'Ich bleibe.',
        'Ja, weiter, oder?'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    sepp: {
      pass: [
        'Ich passe.',
        'Basst, ich lass.',
        'Diesmal nicht.',
        'Ohne mi.',
        'I lass euch vor.',
        'Passe. Ganz gmiadlich.',
        'I steig aus.',
        'Heute ned.'
      ],
      hold: [
        'Ja.',
        'I halt.',
        'I bleib dabei.',
        'Ja, i geh mit.',
        'I halt mit.',
        'Gern, weiter.',
        'I bleib.',
        'Ja, in Ruh.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiel i.',
        'Des Spiel nimm i.',
        'I fang an.',
        'Nun spiel i.',
        'Des wird meins.',
        'I übernimm.',
        'So, i spiel.'
      ]
    },
    hilde: {
      pass: [
        'Ich passe.',
        'Diesmal nicht, Kind.',
        'Ich lasse es.',
        'Ohne mich, in Ruhe.',
        'Ich warte lieber.',
        'Passe. Der Kaffee bleibt warm.',
        'Ich steige aus.',
        'Heute passe ich.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Gern, Kind.',
        'Ich bleibe.',
        'Ja, weiter.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    lena: {
      pass: [
        'Ich passe.',
        'Diesmal nicht.',
        'Ohne mich.',
        'Ich lasse es fair.',
        'Heute passe ich.',
        'Ich warte lieber.',
        'Passe. Ganz sportlich.',
        'Ich steige aus.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Gern, weiter.',
        'Ich bleibe.',
        'Ja, fair weiter.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    jonas: {
      pass: [
        'Ich passe.',
        'Diesmal nicht.',
        'Ohne mich, danke.',
        'Ich lasse euch vor.',
        'Heute passe ich.',
        'Ich warte lieber.',
        'Passe. Ganz höflich.',
        'Ich steige aus.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Gern, weiter.',
        'Ich bleibe.',
        'Ja, bitte weiter.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    oemer: {
      pass: [
        'Ich passe.',
        'Diesmal nicht.',
        'Ohne mich, gern so.',
        'Ich lasse euch den Platz.',
        'Heute passe ich.',
        'Ich warte lieber.',
        'Passe. Ganz herzlich.',
        'Ich steige aus.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Aber gern.',
        'Ich bleibe.',
        'Ja, kommt mit.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    ruediger: {
      pass: [
        'Ich passe.',
        'Diesmal nicht.',
        'Ohne mich.',
        'Ich lasse es.',
        'Heute passe ich.',
        'Das ist die ruhige Wahl.',
        'Passe. Ganz klar.',
        'Ich steige aus.'
      ],
      hold: [
        'Ja.',
        'Ich halte.',
        'Ich bleibe dabei.',
        'Ja, ich gehe mit.',
        'Ich halte mit.',
        'Gern, weiter.',
        'Ich bleibe.',
        'Ja, genau so.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiele ich.',
        'Das Spiel nehme ich.',
        'Ich fange an.',
        'Nun spiele ich.',
        'Das wird meins.',
        'Ich übernehme.',
        'So, ich spiele.'
      ]
    },
    chantal: {
      pass: [
        'Ich passe.',
        'Diesmal nich.',
        'Ohne mich, ne.',
        'Ich lass dat.',
        'Heute pass ich.',
        'Lieber warten.',
        'Passe. Ganz locker.',
        'Ich steig aus.'
      ],
      hold: [
        'Ja.',
        'Ich halt.',
        'Ich bleib dabei.',
        'Ja, ich geh mit.',
        'Ich halt mit.',
        'Aber gern.',
        'Ich bleib.',
        'Ja, weiter, ne.'
      ],
      open: [
        'Ich spiele.',
        'Dann spiel ich.',
        'Dat Spiel nehm ich.',
        'Ich fang an.',
        'Nun spiel ich.',
        'Dat wird meins.',
        'Ich übernehm.',
        'So, ich spiel.'
      ]
    }
  };

  var KEY = 'sf-sprueche-v1';
  var AI_EVERY = 4;
  var AI_WAIT_MS = 3000;
  var AI_WORDS = 12;
  var CHAT_PATHS = ['/api/sf/chat', '/api/chat', '/api/default/chat'];
  var bags = {};
  var recent = {};
  var lastGlobal = '';
  var nextAt = 0;
  var customStore = null;
  var loaded = false;
  var moveCount = 0;
  var lastAiMove = 0;
  var aiBusy = false;
  var aiDown = 0;
  var chatBase = 0;

  function canon(id) {
    if (id === 'oma-hilde') return 'hilde';
    return id || '';
  }

  function storage() {
    if (customStore) return customStore;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (err) { /* privat oder voll */ }
    if (!storage.memory) storage.memory = {};
    return {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage.memory, key) ? storage.memory[key] : null; },
      setItem: function (key, value) { storage.memory[key] = String(value); },
      removeItem: function (key) { delete storage.memory[key]; }
    };
  }

  function load() {
    if (loaded) return;
    loaded = true;
    try {
      var raw = storage().getItem(KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && data.recent && typeof data.recent === 'object') recent = data.recent;
      if (data && typeof data.lastGlobal === 'string') lastGlobal = data.lastGlobal;
    } catch (err) { recent = {}; }
  }

  function persist() {
    try {
      storage().setItem(KEY, JSON.stringify({ recent: recent, lastGlobal: lastGlobal }));
    } catch (err) { /* der Beutel im Speicher reicht */ }
  }

  function unique(list) {
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var line = list[i];
      if (!line || seen[line]) continue;
      seen[line] = true;
      out.push(line);
    }
    return out;
  }

  function shuffle(list, rng) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      if (j < 0 || j > i) j = 0;
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function situationOf(event) {
    return SITUATION[event] || 'banter';
  }

  function pool(id, situation) {
    var bank = POOLS[canon(id)] || {};
    return (bank[situation] || []).slice();
  }

  function replyPool(id, kind, local) {
    var bank = REPLIES[canon(id)] || {};
    var extra = bank[kind] || bank.default || [];
    return unique([].concat(local || [], extra));
  }

  function callPool(id, token, local) {
    var own = (CALLS[canon(id)] || {})[token];
    var base = own && own.length ? own : ((CALLS.standard || {})[token] || []);
    return unique([].concat(local || [], base));
  }

  function call(id, token, local, rng) {
    var merged = callPool(id, token, local);
    if (!merged.length) return null;
    return draw(id, 'call:' + token, merged, rng);
  }

  function draw(id, bagKey, poolLines, rng) {
    load();
    var who = canon(id);
    var lines = unique(poolLines || []);
    if (!lines.length) return null;
    var random = typeof rng === 'function' ? rng : Math.random;
    var sig = lines.join('\u0001');
    var bag = bags[who + '|' + bagKey];
    if (!bag || bag.sig !== sig) bag = bags[who + '|' + bagKey] = { sig: sig, order: shuffle(lines, random), i: 0 };
    var mem = recent[who] || [];
    var keep = Math.max(1, Math.ceil(lines.length * 0.75) - 1);
    var tail = mem.slice(Math.max(0, mem.length - keep));
    var chosen = null;
    var step = 0;
    for (var n = 0; n < bag.order.length; n++) {
      var candidate = bag.order[(bag.i + n) % bag.order.length];
      if (tail.indexOf(candidate) >= 0) continue;
      if (candidate === lastGlobal && lines.length > 1) continue;
      chosen = candidate;
      step = n + 1;
      break;
    }
    if (!chosen) {
      for (var m = 0; m < bag.order.length; m++) {
        var alt = bag.order[(bag.i + m) % bag.order.length];
        if (alt !== lastGlobal || lines.length === 1) {
          chosen = alt;
          step = m + 1;
          break;
        }
      }
    }
    if (!chosen) chosen = bag.order[bag.i % bag.order.length];
    bag.i = (bag.i + Math.max(1, step)) % bag.order.length;
    if (bag.i === 0) bag.order = shuffle(lines, random);
    lastGlobal = chosen;
    mem = mem.filter(function (line) { return line !== chosen; });
    mem.push(chosen);
    if (mem.length > 48) mem = mem.slice(mem.length - 48);
    recent[who] = mem;
    persist();
    return chosen;
  }

  /* Kurze Saison-Zeilen. Sie kommen nur dazu, solange der passende
     Tisch in SpielpartnerOrte offen ist, und ersetzen den Vorrat nicht. */
  var SEASON_LINES = {
    halloween: {
      horst: [
        "Na, Kürbis aufm Tisch. Is warm hier, keen Schreck.",
        "Kerzen an, Karten her. Halloween bleibt gemütlich."
      ],
      margarethe: [
        "Ein Kürbis und Kerzenlicht. Wie hübsch das ist, Schätzchen.",
        "Herbstblätter, warmes Licht. Setz Dich, es ist friedlich."
      ],
      urs: [
        "Grüezi. Der Kürbis darf bleiben, das Spiel bleibt ruhig.",
        "Kerzenlicht und Karten. Mehr Halloween braucht es nicht."
      ],
      vreni: [
        "Hoi. Der Kürbis lächelt, und ich auch.",
        "Kerzen an, Tee dazu. So mag ich Halloween."
      ],
      sepp: [
        "Servus. Der Kürbis ist freundlich, die Karten auch.",
        "Kerzenlicht und Herbstlaub. Passt zum Stammtisch."
      ],
      hilde: [
        "Na, Kind. Kürbis, Kerze, und der Kuchen ist auch da.",
        "Halloween, aber gemütlich. Der Abend bleibt freundlich."
      ],
      lena: [
        "Hallo. Kürbislaterne an, und dann ganz normal Karten.",
        "Schönes warmes Licht. Halloween darf freundlich sein."
      ],
      jonas: [
        "Die Laterne brennt, der Platz ist frei. Ganz ohne Aufregung.",
        "Kürbis auf dem Tisch, Karten in der Hand. So bleibt es nett."
      ],
      oemer: [
        "Komm rein. Der Kürbis ist Schmuck, die Tür bleibt offen.",
        "Kerzenlicht und ein freier Platz. Halloween, ganz friedlich."
      ],
      ruediger: [
        "Guten Abend. Ein Kürbis, Kerzen, und ein faires Spiel.",
        "Herbstlicht am Tisch. Mehr braucht dieser Abend nicht."
      ],
      chantal: [
        "Hömma, Kürbis steht, Kerze brennt. Dat wird gemütlich.",
        "Nur warmes Licht, kein Schreck. Rück den Stuhl ran."
      ]
    }
  };

  function seasonOpen(id, now) {
    var g = typeof globalThis !== 'undefined' ? globalThis : null;
    var Orte = g && g.SpielpartnerOrte;
    if (!Orte || typeof Orte.seasonOpen !== 'function') return false;
    return Orte.seasonOpen(id, now);
  }

  function seasonLines(id, season) {
    var bank = SEASON_LINES[season || 'halloween'] || {};
    return (bank[canon(id)] || []).slice();
  }

  function line(id, event, local, rng, now) {
    var situation = situationOf(event);
    var extra = pool(id, situation);
    var merged = unique([].concat(local || [], extra));
    if (!merged.length) merged = pool(id, 'banter');
    if ((situation === 'greetings' || situation === 'banter') && seasonOpen('halloween', now)) {
      merged = unique(merged.concat(seasonLines(id, 'halloween')));
    }
    return draw(id, event || situation, merged, rng);
  }

  function reply(id, kind, local, rng) {
    var merged = replyPool(id, kind || 'default', local);
    if (!merged.length) merged = pool(id, 'banter');
    return draw(id, 'reply:' + (kind || 'default'), merged, rng);
  }

  var EVENT_DE = {
    welcome: 'Begrüßung', greet: 'Begrüßung', bidding: 'Reizen', bidHigh: 'hohes Reizen',
    passBid: 'Passen', declare: 'Ansage', gameStart: 'Spielbeginn', trick: 'Stich',
    win: 'Gewinn', lose: 'Verlust', selfWins: 'Stich gewonnen', humanWins: 'Stich des Menschen',
    goodMove: 'guter Zug', badLuck: 'Pech', encourage: 'Zuspruch', handWin: 'Spiel gewonnen',
    handLose: 'Spiel verloren', matchWin: 'Runde gewonnen', matchLose: 'Runde verloren'
  };
  var LINE_BLOCK = /\b(grok|x\.?ai|openai|eleven|chatgpt|sprachmodell|politik|partei|einkommen)\b|künstliche intelligenz/i;

  function clampWords(text) {
    var t = String(text || '').replace(/[—–]/g, ',').replace(/\s+/g, ' ').trim();
    t = t.replace(/^["„«]+|["“»]+$/g, '');
    var words = t.split(' ').filter(Boolean);
    if (words.length > AI_WORDS) t = words.slice(0, AI_WORDS).join(' ');
    return t;
  }

  function acceptable(text) {
    var t = clampWords(text);
    if (!t) return '';
    if (LINE_BLOCK.test(t)) return '';
    if (/nicht erreichbar|gateway timeout/i.test(t)) return '';
    return t;
  }

  function situationLine(opts) {
    var given = String(opts.situation || '').trim();
    if (given) return given.slice(0, 240);
    var ev = EVENT_DE[opts.event] || '';
    return ev ? ('Lage ' + ev) : 'Lage am Tisch';
  }

  function postRemark(opts, signal) {
    var who = canon(opts.character);
    if (!who) return Promise.reject(new Error('wer'));
    var g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (!g || typeof g.fetch !== 'function') return Promise.reject(new Error('kein fetch'));
    var message = 'Lage: ' + situationLine(opts);
    var url = CHAT_PATHS[chatBase] || CHAT_PATHS[0];
    return g.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        character: who,
        message: message,
        purpose: 'remark',
        game: opts.game || null,
        history: []
      }),
      signal: signal
    }).then(function (res) {
      if (!res || !res.ok) throw new Error('status');
      return res.json();
    }).then(function (data) {
      var text = data && typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) throw new Error('leer');
      return text;
    });
  }

  function freshComment(opts) {
    opts = opts || {};
    moveCount += 1;
    var fallback = typeof opts.fallback === 'function' ? opts.fallback : function () { return null; };
    var wait = typeof opts.timeout === 'number' ? opts.timeout : AI_WAIT_MS;
    var due = !!opts.forceFresh || (aiDown < 2 && !aiBusy && moveCount - lastAiMove >= AI_EVERY);
    if (!due) return Promise.resolve(fallback());
    aiBusy = true;
    lastAiMove = moveCount;
    var ctrl = null;
    try { ctrl = typeof AbortController === 'function' ? new AbortController() : null; } catch (err) { ctrl = null; }
    var timer = null;
    var slow = new Promise(function (resolve) {
      timer = setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) { /* schon zu */ } }
        resolve(null);
      }, wait);
    });
    var ask = typeof opts.ask === 'function'
      ? function () { return opts.ask(ctrl && ctrl.signal); }
      : function () { return postRemark(opts, ctrl && ctrl.signal); };
    var request = Promise.resolve().then(ask).then(function (text) {
      return acceptable(text) || null;
    }, function () { return null; });
    return Promise.race([request, slow]).then(function (text) {
      if (timer) clearTimeout(timer);
      aiBusy = false;
      if (text) aiDown = 0;
      else aiDown += 1;
      return text || fallback();
    });
  }

  function allow(opts) {
    opts = opts || {};
    if (opts.force) return true;
    var rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    var now = typeof opts.now === 'number' ? opts.now : Date.now();
    if (now < nextAt) return false;
    var roll = rng();
    if (roll < 0.28) {
      nextAt = now + 2400 + Math.floor(rng() * 2200);
      return false;
    }
    nextAt = now + 3000 + Math.floor(rng() * 4000);
    return true;
  }

  function reset(opts) {
    opts = opts || {};
    bags = {};
    recent = {};
    lastGlobal = '';
    nextAt = 0;
    moveCount = 0;
    lastAiMove = 0;
    aiBusy = false;
    aiDown = 0;
    loaded = true;
    if (opts.store) customStore = opts.store;
    if (opts.wipe !== false) {
      try { storage().removeItem(KEY); } catch (err) { /* schon leer */ }
    }
  }

  return {
    canon: canon,
    situationOf: situationOf,
    pool: pool,
    replyPool: replyPool,
    callPool: callPool,
    line: line,
    seasonLines: seasonLines,
    reply: reply,
    call: call,
    allow: allow,
    freshComment: freshComment,
    reset: reset,
    characters: Object.keys(POOLS),
    situations: ['greetings', 'bidding', 'winning', 'losing', 'goodMove', 'badLuck', 'banter']
  };
});
