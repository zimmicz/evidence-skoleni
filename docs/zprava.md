# Evidence školení

## Co jsem postavil a proč

Vycházím z několika předpokladů:

- primárním uživatelem aplikace je HR
  - doplnit další pozice/role a omezit jejich oprávnění není problém
- HR nemá právo zakládat nebo nová školení, nová oddělení, nové zaměstnance
  - aplikace jako vstup používá export z jiných systémů, v současné době do nich tedy nemá write přístup
- primárním cílem HR je mít pořádek ve školeních a proškolené všechny zaměstnance, kteří proškolení být mají (že to např. z kapacitních důvodů není možné, není problém HR)

### Obrazovky

**Agenda**

- co má HR dnes udělat – nevyřešená data, termíny k potvrzení, lidé bez místa, seřazeno podle naléhavosti
- snažím se vžít se do role HR -> nechci každý den filtrovat zaměstnance nebo školení a zjišťovat, co mám kde udělat. Místo toho chci, aby mi aplikace říkala, co je potřeba udělat.

**Přehled**

- matice útvar × školení, nejbližší konce platnosti

**Zaměstnanci**

- filtry podle útvaru, týmu vedoucího včetně podřízených, stavu povinnosti; detail s historií

**Termíny**

- návrhy přihlášek, potvrzení / přesun / odebrání, obsazenost „z exportu + potvrzeno“

**Kvalita dat**
Data po prozkoumání považuji za **nedůvěryhodná**. Obsahují překlepy, různé formáty datumů, potenciální duplicity, nevalidní e-maily a jiné chyby. Proto jsem poměrně dost času věnoval právě této obrazovce, která HR dá obrázek o tom, jakými daty ji její kolegové zásobují. HR s tím mnoho nezmůže, ale v aplikaci má nástroje k očištění dat, ať s nimi může pracovat, než kolegové z IT oddělení exporty opraví.

Každá hodnota projde jednou ze tří cest:

- **jednoznačná oprava** (mezery, velikost písmen, formáty data včetně čísel z Excelu) se provede automaticky a je vidět v seznamu
- **nesrovnalost** (překlep v kódu, neznámý útvar, neexistující zaměstnanec, nemožné datum, přeplněný termín…) rozhodne HR – opravit na navrženou hodnotu, vyřadit, nebo ponechat
- **strukturálně rozbitý řádek** (opakovaná hlavička, řádek „Celkem“, komentář) se odmítne. Duplicitní ID se porovnají obsahem: shodný řádek se odmítne, odlišný je nesrovnalost. Po každém načtení se zobrazí souhrn. Dokud nesrovnalost není vyřešená, záznam se do výpočtu nezapočítá.

Návrh přihlášek je jednoduchý algoritmus: nejdřív lidé bez školení, pak s prošlou platností, pak ti, komu brzy končí; každý dostane nejbližší termín s volným místem.

## Co jsem zjistil o datech

- čtyři soubory, tři různá kódování/oddělovače (UTF-8 s BOM, windows-1250 s CRLF)
- středník uvnitř pole katalogu
- data ve 4 formátech včetně Excelových čísel (`43552` = 28. 3. 2019, ověřeno rozdílem s `platnost_do`)
- zástupná data 1900, záznamy „zadáno předem“ s datem po exportu
- kódy školení v ~20 variantách (`kyber`, `POZ_OCH`, `KYB3R`, neexistující `BOZP-X`, `GDPR-2`)
- útvary bez diakritiky / zkrácené, 5 zaměstnanců bez útvaru, neplatné e-maily, vedoucí, který neexistuje, dva duplicitní zaměstnanci (stejný e-mail, jméno bez diakritiky), záznamy s neexistujícím ID zaměstnance, nesedící jméno k ID, platnost končící před absolvováním, záporné/textové ceny, duplicitní ID záznamů.
- v termínech: přeplněné termíny, nulová kapacita, duplicitní termín, neexistující datum 31. 9., termíny před datem exportu
- v poznámkách vzorce typu `=HYPERLINK(...)` - export CSV je proto escapuje.

## Předpoklady

- „Dnes“ = 1. 10. 2026 (lze změnit), „brzy končí“ = do 90 dní (lze změnit).
- Platnost: `platnost_do` ze záznamu, jinak datum + platnost z katalogu (katalog se mohl změnit). 0 měsíců = jednorázové, prázdná = nepovinné.
- Ukončení zaměstnanci jsou skrytí, na rodičovské se zobrazují, ale nepřihlašují. Nikdo se nepřihlašuje na termín po svém ukončení.
- Žádná ochranná lhůta pro nováčky (BOZP se dle § 103 odst. 2 ZP školí při nástupu). Kdo teprve nastoupí, má stav „před nástupem“: nezapočítává se do statistik a navrhuje se mu jen termín nejpozději v den nástupu, jinak spadne do „nelze umístit“.
- Obsazená místa v termínech nemají jména – předpokládám, že mezi nimi nikdo z navržených není.
- Potvrzením přihlášky odejde zaměstnanci pozvánka automaticky (napojení na e-mail je mimo rozsah aplikace).

## Co jsem nestihl nebo vynechal

Přihlášení a role (vedoucí vidí jen svůj tým), sdílení stavu mezi uživateli (vše je v localStorage jednoho prohlížeče), kolize termínů jednoho člověka ve stejný den, optimální rozvrh, upozornění e-mailem.

## Co bych dělal dál

Zjistil bych, jestli je na tuhle agendu potřeba vytvářet novou aplikaci. Pokud ano, jak bude napojená na ostatní systémy, ze kterých bude čerpat data.
