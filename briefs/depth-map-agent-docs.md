# Docs: depth map (fake 3D) voor de work items

Hoort bij `briefs/depth-map-agent.md`. Code: `src/animations/depthMap.js`, aangesloten in `src/index.js`.

## In één alinea

Een work item heeft een foto en een depth map (grijswaarden, wit is dichtbij, zwart is ver weg). Het script tekent de foto op een `<canvas>` met WebGL en schuift elke pixel een beetje opzij, afhankelijk van zijn diepte en van waar je muis, vinger of telefoon naartoe wijst. Pixels op het focuspunt staan stil, wat dichterbij is beweegt mee, wat verder weg is beweegt tegengesteld. Zo lijkt de foto diepte te hebben. Gaat er iets mis (geen depth map, geen WebGL, minder beweging aan), dan zie je gewoon de foto.

## De onderdelen

**Markup in Webflow**

```html
<div class="work__media" data-bg-zoom-content
     data-depth-map
     data-depth-strength-x="0.035" data-depth-strength-x-custom="{CMS}"
     data-depth-strength-y="0.025" data-depth-strength-y-custom="{CMS}"
     data-depth-focus="0.5"        data-depth-focus-custom="{CMS}"
     data-depth-smoothing="0.8"    data-depth-smoothing-custom="{CMS}"
     data-depth-zoom="1.06"        data-depth-zoom-custom="{CMS}">
  <img class="work__img" data-bg-zoom-img data-depth-image src="{CMS afbeelding}">
  <img data-depth-source src="{CMS depth-map}" alt="">
  <div class="work__overlay" data-work-media-overlay></div>
</div>
```

**Start en stop in `src/index.js`**

- `initAfterEnterFunctions` roept `initDepthMap(nextPage)` aan als er een `[data-depth-map]` op de pagina staat, en bewaart de cleanup-functie.
- `barba.hooks.afterLeave` roept die cleanup aan. Daarna is alles weg: canvas, WebGL-context, listeners, observers, ticker.

**`initDepthMap(container)`**

1. Stopt meteen als er geen elementen zijn of als "minder beweging" aanstaat.
2. Koppelt de gyro-knop (`[data-depth-gyro-button]`) voor iOS. Op Android zet het de gyro direct aan.
3. Maakt per `[data-depth-map]` één depth map met `createDepthMap(el)`.
4. Geeft één cleanup-functie terug die alle losse cleanups uitvoert.

**`createDepthMap(el)`** doet per element, in deze volgorde:

1. Zoekt de foto en de depth map. Ontbreekt er een, of heeft de depth map geen `src`, dan stopt het en blijft de foto staan.
2. Verbergt de depth map-`<img>` (`display: none`).
3. Maakt een canvas met een WebGL-context. Lukt dat niet, dan stopt het.
4. Zet het canvas direct na de foto in de DOM, onzichtbaar, absoluut gepositioneerd. Omdat de overlay `z-index: 1` heeft, blijft die boven het canvas.
5. Leest de instellingen uit de attributen.
6. Zet de shader op en geeft de vaste instellingen (sterkte, focus, zoom) één keer door aan de GPU.
7. Start de render-loop via `gsap.ticker`.
8. Laat het canvas de box van de foto volgen met een `ResizeObserver` op de foto.
9. Kijkt met een `IntersectionObserver` of het element in beeld is.
10. Laadt de foto en de depth map, uploadt ze als textures, tekent het eerste frame, maakt het canvas zichtbaar en verbergt de foto.
11. Zet de smoothing op met `gsap.quickTo` en koppelt muis, touch en gyro.
12. Geeft de cleanup-functie terug.

## Hoe het tekenen werkt

De shader draait per pixel op de GPU, elke frame dat er iets veranderd is.

1. **Framing als `object-fit: cover`.** De shader vergelijkt de verhouding van het canvas met die van de foto en snijdt het beeld zo bij dat het het canvas vult, precies zoals de gewone `<img>` dat doet. Daarbovenop zoomt het iets in (`zoom`, standaard 1.06) zodat de randen, die door het schuiven leeg zouden lopen, buiten beeld vallen.
2. **Diepte lezen.** Voor deze pixel leest de shader de grijswaarde uit de depth map: 0 is ver weg, 1 is dichtbij.
3. **Verschuiven.** De verschuiving is `muis × (diepte − focus) × sterkte`. Dus:
   - diepte gelijk aan focus: verschuiving 0, staat stil
   - diepte groter dan focus (dichterbij): beweegt mee met de muis
   - diepte kleiner dan focus (verder weg): beweegt tegengesteld
4. **Kleur pakken.** De shader leest de foto op de verschoven plek en tekent die kleur.

`muis` loopt van −1 tot 1 op beide assen. `sterkte` is een fractie van de beeldbreedte, dus 0.03 is maximaal 3% verschuiving voor het verste of dichtstbijzijnde vlak.

## Het canvas volgt de foto

De foto `.work__img` is 100% breed en 115% hoog met `object-fit: cover`. Het canvas kopieert die box (breedte, hoogte, linksboven op 0,0) via een `ResizeObserver` op de foto. Daardoor:

- framen foto en canvas het beeld hetzelfde, dus je ziet geen sprong bij het omschakelen
- groeit het canvas mee als Flip de maat van `.work__media` verandert bij het eerste item
- gaat de `yPercent`-parallax vanzelf goed, want die verplaatst de hele `.work__media`

Bij een resize zet het script ook de pixelmaat van het canvas (schermmaat × devicePixelRatio, maximaal 2) en tekent meteen opnieuw, omdat een canvas leeg wordt zodra je de pixelmaat verandert.

## Laden van de beelden

- De foto wordt pas geladen als het lazy `<img>` van Webflow zelf klaar is (`load`-event). Daardoor laden items onderaan de pagina hun textures pas als de browser eraan toe is, en in de srcset-maat die bij het scherm past.
- WebGL mag alleen beelden gebruiken die met CORS zijn geladen. Het script laadt de foto en de depth map daarom nog een keer met `crossOrigin = "anonymous"`. Dat is dezelfde URL, dus de browser pakt hem uit de cache. De Webflow-CDN stuurt `access-control-allow-origin: *`, dat is getest.
- Mislukt het laden, dan blijft het canvas onzichtbaar en de foto staan.

## Input

Alle input komt uit op `setTarget(x, y, bron)`. Die klemt de waarde tussen −1 en 1 en geeft hem aan twee `gsap.quickTo`-tweens (x en y). De `smoothing` is de duur van die tween, met `power3.out`. De render-loop tekent daarna elk frame de tussenstand.

- **Muis.** `pointermove` op `window`, alleen `pointerType === "mouse"`. Positie ten opzichte van het hele scherm, dus ook als de muis naast het item staat beweegt het beeld mee.
- **Touch.** `pointermove` op het element zelf. Positie ten opzichte van het element. Bij loslaten (`pointerup`, `pointercancel`) gaat het beeld terug naar het midden. Zolang de gyro data stuurt wordt touch genegeerd, anders vechten ze.
- **Gyro.** Eén `deviceorientation`-listener voor de hele site, gedeeld door alle items. Hij ijkt zijn nulpunt op de eerste meting en laat dat nulpunt daarna heel langzaam meelopen met hoe je de telefoon vasthoudt, zodat je niet "vast" komt te zitten aan een schuine stand. Twintig graden kantelen is volle uitslag. In landscape worden de assen omgewisseld.
  - iOS vraagt toestemming, en dat mag alleen vanuit een tik. Daarom de knop met `data-depth-gyro-button`.
  - Android vraagt niets, dus daar start de gyro vanzelf op apparaten met een touchscreen (`pointer: coarse`).

## Instellingen en de CMS-override

Elke instelling wordt zo gelezen:

```
custom gevuld?  → custom
anders standaard gevuld?  → standaard
anders  → fallback in de code
```

Een lege string telt als "niet gevuld". Dat is precies wat Webflow doorgeeft bij een leeg CMS-veld. Alle waardes zijn getallen. Ze worden één keer gelezen bij init, niet live.

| Instelling | Standaard-attribuut | Override | Fallback | Betekenis |
|---|---|---|---|---|
| Sterkte X | `data-depth-strength-x` | `…-custom` | 0.03 | Horizontale verschuiving, fractie van de breedte |
| Sterkte Y | `data-depth-strength-y` | `…-custom` | 0.02 | Verticale verschuiving |
| Focus | `data-depth-focus` | `…-custom` | 0.5 | Diepte die stilstaat, 0 = achter, 1 = voor |
| Smoothing | `data-depth-smoothing` | `…-custom` | 0.8 | Naloopduur in seconden |
| Zoom | `data-depth-zoom` | `…-custom` | 1.06 | Inzoomen om de randen te verbergen |

## Fallbacks

| Situatie | Wat er gebeurt |
|---|---|
| Minder beweging aan | `initDepthMap` doet niets, de foto blijft |
| Geen `[data-depth-image]` of `[data-depth-source]` | Dit item wordt overgeslagen |
| Depth map-veld leeg (geen `src`) | Dit item wordt overgeslagen |
| Geen WebGL | Dit item wordt overgeslagen, de foto blijft |
| Foto of depth map laadt niet | Canvas blijft onzichtbaar, de foto blijft |
| Element buiten beeld | Er wordt niet getekend |
| Positie niet veranderd | Er wordt niet getekend |

## Barba en opruimen

De cleanup per item verwijdert de ticker-callback, stopt de tweens, haalt alle listeners weg, stopt beide observers, geeft de WebGL-context vrij (`WEBGL_lose_context`), haalt het canvas uit de DOM en maakt de foto weer zichtbaar. De gyro-listener op `window` blijft bewust staan: die is er één voor de hele site, en een guard voorkomt dat hij dubbel komt.

Controle na een paginawissel heen en terug, in de console:

```js
document.querySelectorAll("canvas").length
```

Dat moet gelijk zijn aan het aantal items met een depth map op de huidige pagina.

## Prestaties

- Er wordt alleen getekend als het item in beeld is én de positie sinds het vorige frame is veranderd. Stilstaand kost het niets.
- Eén quad, twee textures, een shader van twintig regels. Geen library.
- Pixelmaat is gemaximeerd op devicePixelRatio 2.
- Textures worden pas geladen als de lazy foto van Webflow zelf laadt.

## Webflow inrichten, stap voor stap

1. Zet op `.work__media` het attribuut `data-depth-map` plus de standaard-attributen met de waardes uit de testbank.
2. Zet op dezelfde `.work__media` de vijf `-custom`-attributen en koppel elk aan een CMS-veld (getal of tekst). Laat ze leeg waar je de standaard wilt.
3. Zet op `img.work__img` het attribuut `data-depth-image`.
4. Voeg in `.work__media` een image-element toe, koppel het aan het CMS-veld `depth-map`, geef het `data-depth-source` en een lege `alt`. Verbergen hoeft niet, het script doet dat.
5. Wil je gyro op iOS, zet dan ergens een knop met `data-depth-gyro-button`.
6. Publiceer naar staging en loop de testlijst uit de brief af.

## Depth maps maken en afstellen

- Maak de depth map met [Depth Anything V2](https://huggingface.co/spaces/depth-anything/Depth-Anything-V2). Wit dichtbij, zwart ver weg. Zelfde verhouding als de foto.
- Blur de depth map licht (een paar pixels). Harde randen in de map geven scheuren bij het schuiven.
- Zie je randen van het beeld inlopen, zet zoom iets hoger of de sterkte iets lager.
- Voelt het "los" (onderwerp zweeft te veel), zet het focuspunt dichter bij de diepte van het onderwerp.
- Voelt het traag, verlaag de smoothing. Voelt het nerveus, verhoog hem.

## Problemen zoeken

| Klacht | Kijk naar |
|---|---|
| Niets beweegt, wel de foto | Minder beweging aan? Staat `data-depth-map` op `.work__media`? Heeft de depth map een `src`? Console-fouten over CORS? |
| Beeld verspringt bij het laden | Foto en canvas framen anders. Controleer dat de foto `data-depth-image` heeft en dat er niets anders de maat van de foto verandert. |
| Overlay zit onder het beeld | De overlay moet `z-index: 1` houden en na de foto in de DOM staan. |
| Gyro doet niets op iPhone | Is er op de knop getikt? Toestemming geweigerd? Dan herstellen via Safari-instellingen van de site. |
| Dubbel effect na paginawissel | Wordt de cleanup wel aangeroepen in `afterLeave`? Tel de canvassen. |
