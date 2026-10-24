# Evidence školení – průvodní text

## Co jsem postavil a proč

Statickou webovou aplikaci (React, TypeScript, Vite, Tailwind, shadcn/ui) nasazenou na GitHub Pages. Backend jsem vynechal (dle odpovědi na dotaz není potřeba): CSV se zpracují přímo v prohlížeči, takže osobní údaje nikam neodcházejí a hosting je zdarma. Jádro je čistá doménová vrstva (parsování → validace → vyhodnocení povinností → návrh přihlášek) bez Reactu, otestovaná Vitestem přímo na dodaných datech; hlavní průchody UI hlídá Playwright. Zod validuje vstupy formulářů i stav načítaný z localStorage, formuláře řeší react-hook-form.

Obrazovky: **Agenda** (úvodní stránka: co má HR dnes udělat – nevyřešená data, termíny k potvrzení, lidé bez místa, seřazeno podle naléhavosti), **Přehled** (KPI, matice útvar × školení, nejbližší konce platnosti), **Zaměstnanci** (filtry podle útvaru, týmu vedoucího včetně podřízených, stavu povinnosti; detail s historií), **Termíny** (návrhy přihlášek, potvrzení / přesun / odebrání, obsazenost „z exportu + potvrzeno“ se mění hned po potvrzení, export CSV pro pořadatele), **Kvalita dat**.

Data beru jako nedůvěryhodná. Každá hodnota projde jednou ze tří cest: **jednoznačná oprava** (mezery, velikost písmen, formáty data včetně čísel z Excelu) se provede automaticky a je vidět v seznamu; **nesrovnalost** (překlep v kódu, neznámý útvar, neexistující zaměstnanec, nemožné datum, přeplněný termín…) rozhodne HR – opravit na navrženou hodnotu, vyřadit, nebo ponechat; **strukturálně rozbitý řádek** (opakovaná hlavička, řádek „Celkem“, komentář) se odmítne. Duplicitní ID se porovnají obsahem: shodný řádek se odmítne, odlišný je nesrovnalost. Po každém načtení se zobrazí souhrn. Dokud nesrovnalost není vyřešená, záznam se do výpočtu nezapočítá.

Návrh přihlášek je hladový algoritmus: nejdřív lidé bez školení, pak s prošlou platností, pak ti, komu brzy končí; každý dostane nejbližší termín s volným místem. Kapacita v datech na pokrytí stačí, problém je načasování – optimalizaci jsem vědomě odložil (docs/adr/0001).

## Co jsem zjistil o datech

Čtyři soubory, tři různá kódování/oddělovače (UTF-8 s BOM, windows-1250 s CRLF), středník uvnitř nekvótovaného pole katalogu. Data ve 4 formátech včetně Excelových čísel (`43552` = 28. 3. 2019, ověřeno rozdílem s `platnost_do`), zástupná data 1900, záznamy „zadáno předem“ s datem po exportu. Kódy školení v ~20 variantách (`kyber`, `POZ_OCH`, `KYB3R`, neexistující `BOZP-X`, `GDPR-2`). Útvary bez diakritiky / zkrácené, 5 zaměstnanců bez útvaru, neplatné e-maily, vedoucí, který neexistuje, dva duplicitní zaměstnanci (stejný e-mail, jméno bez diakritiky), záznamy s neexistujícím ID zaměstnance, nesedící jméno k ID, platnost končící před absolvováním, záporné/textové ceny, duplicitní ID záznamů. V termínech: přeplněné termíny, nulová kapacita, duplicitní termín, neexistující datum 31. 9., termíny před datem exportu. V poznámkách vzorce typu `=HYPERLINK(...)` – export CSV je proto escapuje.

## Předpoklady

- „Dnes“ = 1. 10. 2026 (lze změnit), „brzy končí“ = do 90 dní (lze změnit).
- Platnost: `platnost_do` ze záznamu, jinak datum + platnost z katalogu (katalog se mohl změnit). 0 měsíců = jednorázové, prázdná = nepovinné.
- Ukončení zaměstnanci jsou skrytí, na rodičovské se zobrazují, ale nepřihlašují. Nikdo se nepřihlašuje na termín po svém ukončení.
- Žádná ochranná lhůta pro nováčky (BOZP se dle § 103 odst. 2 ZP školí při nástupu). Kdo teprve nastoupí, má stav „před nástupem“: nezapočítává se do statistik a navrhuje se mu jen termín nejpozději v den nástupu, jinak spadne do „nelze umístit“.
- Obsazená místa v termínech nemají jména – předpokládám, že mezi nimi nikdo z navržených není.
- Potvrzením přihlášky odejde zaměstnanci pozvánka automaticky (napojení na e-mail je mimo rozsah aplikace).

## Co jsem nestihl nebo vynechal

Přihlášení a role (vedoucí vidí jen svůj tým), sdílení stavu mezi uživateli (vše je v localStorage jednoho prohlížeče), kolize termínů jednoho člověka ve stejný den, optimální rozvrh, upozornění e-mailem. Široké tabulky se na mobilu posouvají uvnitř karty.

## Co bych dělal dál

Backend s databází a SSO (MUNI), import přímo z personálního systému místo CSV, auditní log rozhodnutí o datech, upozornění vedoucím před koncem platnosti, předávání přihlášek pořadateli a zpětný import absolvování, optimalizace přihlášek s jasně zvoleným cílem (min. počet lidí bez platného školení).
