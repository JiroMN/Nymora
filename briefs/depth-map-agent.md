# Brief: fake-3D depth map voor de Nymora work items

## Wat we willen bereiken

De foto's van de work items krijgen diepte, zoals op de website van Lando Norris. Beweeg je de muis, sleep je op touch of kantel je je telefoon, dan beweegt de voorgrond meer dan de achtergrond. Bij elke foto hoort een eigen depth map: een grijswaardenbeeld waarin wit dichtbij is en zwart ver weg.

Het moet aanvoelen als een kleine library. Wij zetten data-attributen op een element in Webflow, vullen waardes in, en het werkt. Nu is het voor ongeveer vier work items, later misschien op meer plekken op de site.

Jij bouwt de functie. Webflow richten wij in op basis van wat jij ons teruggeeft.

## Hoe we van jou willen dat je werkt

Je bent de senior. Wij beschrijven het doel en de eisen, en hoe je het bouwt bepaal jij.

Stel jezelf tijdens het bouwen steeds deze vragen:
- Kan dit simpeler, met hetzelfde effect? Is het antwoord ja of misschien, ga dan eerst daarvoor.
- Is deze regel echt nodig, of los ik een probleem op dat we niet hebben?
- Snapt iemand die dit over een half jaar leest het in één keer? De code moet lezen als een kinderboek.

Zo min mogelijk code, zoveel mogelijk effect. Begin met een MVP die werkt, laat ons testen, en verbeter daarna wat we tegenkomen. Liever drie kleine stappen dan één grote.

## De eisen

**Het effect**
- Werkt met muis, touch en gyroscoop. iOS vraagt toestemming via een tik, Android niet.
- Per element in te stellen: minimaal de sterkte, het focuspunt (welke diepte stilstaat) en de smoothing. Voeg alleen meer toe als je het echt nodig vindt, zoals zoom om de randen te verbergen.
- Degradeert netjes: geen depth map, geen WebGL, of "minder beweging" aan betekent dat de gewone foto blijft staan.

**Instellingen via data-attributen**
- Elke instelling heeft een **standaardwaarde** die wij handmatig als attribuut in Webflow zetten.
- Daarnaast is er per instelling een **custom waarde** die aan een CMS-veld gekoppeld is. Is de custom waarde gevuld, dan wint die van de standaardwaarde. Een leeg CMS-veld komt als lege string door en telt als "niet ingesteld".
- Ontbreken beide, dan valt de code terug op een eigen redelijke waarde.
- De namen kies jij. Houd ze consistent met de rest van de site (`data-…`, kebab-case) en geef ons een lijst terug.

**Alleen waar het gebruikt wordt**
- Het draait alleen op elementen met het attribuut, niet globaal op de site. We gebruiken Barba, en de site wordt later groter.
- Barba-proof: WebGL-contexten, listeners en tickers mogen niet opstapelen tussen paginawissels.
- Buiten beeld kost het niets. Er staan ongeveer vier foto's op volledig schermformaat onder elkaar, ook op telefoons.

## Context over het project

**Stack**
- Webflow met Barba en Lenis, via het page-transition-boilerplate van Osmo.
- GSAP (met ScrollTrigger, Flip, SplitText en CustomEase) wordt via CDN in Webflow geladen, als globals en niet via npm.
- Onze code zit in deze repo en wordt met webpack gebundeld naar `dist/`:
  - `npm run dev` serveert op `localhost:3000`, en die URL laadt de staging-site (`nymora.webflow.io`)
  - `npm start` maakt de productiebuild voor jsDelivr

**Structuur van de code**
- `src/index.js` is het boilerplate. Functies starten in `initAfterEnterFunctions(next)` en worden opgeruimd in `barba.hooks.afterLeave`. Kijk naar hoe `initWorkZoom` daar een cleanup-functie teruggeeft; dat patroon willen we hier ook.
- Animaties staan elk in hun eigen bestand in `src/animations/` en worden met `require` geïmporteerd.

**Waar het effect komt**
- `.work__media` (`[data-bg-zoom-content]`) bevat de foto `img.work__img` (`[data-bg-zoom-img]`, 115% hoog, `object-fit: cover`) en een overlay `.work__overlay` (`z-index: 1`).
- Deze media wordt al bewogen door andere animaties, en daar moet jouw canvas netjes mee samengaan:
  - Bij het **eerste item** verandert Flip de breedte, de hoogte en de positie van `.work__media` terwijl je scrolt (`src/animations/workZoom.js`). Het canvas moet dus meegroeien van klein naar fullscreen.
  - Bij de andere items krijgt de media een `yPercent`-parallax (`src/animations/workShowcases.js`).
  - De overlay wordt geanimeerd (`autoAlpha`, `backdropFilter`) en moet boven het beeld blijven.
- Webflow-classes laden vóór onze CSS. Een CSS-regel op een attribuut kan dus ongemerkt een Webflow-class overschrijven, zoals `position` of `height`. Let daarop, of zet stijlen liever vanuit JS.

**CMS**
- De collectie "Works" heeft al de velden `afbeelding` en `depth-map`, allebei afbeeldingen.
- Voor zover wij konden zien kan een afbeeldingsveld in Webflow alleen aan een image-element gekoppeld worden, niet aan de waarde van een attribuut. Ga er dus van uit dat de depth map als een (verborgen) `<img>` op de pagina staat.
- CORS is in orde. De Webflow-CDN (`cdn.prod.website-files.com`) geeft `access-control-allow-origin: *` terug, en dat is getest.

## Waar je op kunt bouwen

Bouw niet vanaf nul, maar op een bewezen fundament.

**Onze testbank**
Link: https://claude.ai/artifact/HS1X6ZfEL7q8KAQ6hFXbeu

Die kun je lezen met de Artifact-tool (`action: "read"`). Er zit een werkende `initDepthMap()` in, gebaseerd op het principe van [akella/fake3d](https://github.com/akella/fake3d), met:
- focuspunt, sterkte per as, zoom en invert
- een `ResizeObserver` en een `IntersectionObserver`
- een gyro die zijn nulpunt ijkt en corrigeert voor landscape
- fallbacks
- een cleanup die de WebGL-context vrijgeeft

De instellingen die we in de testbank goed vinden, willen we op de site terugzien.

**Andere opties**
Een library zoals PixiJS (`DisplacementFilter`) mag ook, als die zijn gewicht waard is. Wat wij tot nu toe zagen:
- Pixi leest makkelijk, maar weegt ongeveer 150 KB gzipped.
- Het standaardfilter heeft geen instelbaar focuspunt.
- Resizen, pauzeren buiten beeld en cleanup moet je er alsnog zelf bij bouwen.

Weeg het zelf af en leg in een paar zinnen uit waarom je kiest wat je kiest.

## Werkafspraken

- **Werk zoals Osmo** (hun resources en het boilerplate in `src/index.js`): data-attributen, één init-functie, GSAP voor de loop en de smoothing. Wijk je af, meld dat dan **voordat** je het bouwt en laat ons beslissen.
- **Raak alleen aan wat nodig is.** Je eigen bestand in `src/animations/`, plus de paar regels in `src/index.js` om te starten en op te ruimen. Laat `workZoom.js` en `workShowcases.js` met rust. Moet daar echt iets veranderen, stel het dan eerst voor.
- **Niet committen of pushen** tenzij we erom vragen.
- **Communiceer in het Nederlands, simpel en kort.** Commentaar in de code in het Engels, zoals de rest van de codebase.

## Wat we terug willen

1. De functie in `src/animations/`, aangesloten in `src/index.js`, met een build die slaagt (`npx webpack`).
2. **De attributenlijst:** per attribuut de naam, wat het doet, de standaardwaarde en of het een CMS-override heeft. Daarmee richten wij Webflow in.
3. **Een korte testlijst voor staging:** muis, touch, gyro op een echte telefoon, een paginawissel heen en terug (er stapelt niets op), minder beweging, en een item zonder depth map.
4. Een paar zinnen over je keuzes, en wat je bewust hebt weggelaten.

## Documentatie

Hoe alles werkt staat in `briefs/depth-map-agent-docs.md`: de onderdelen, de shader, het laden, de input, de attributen, de fallbacks, Barba, en hoe je Webflow inricht.
