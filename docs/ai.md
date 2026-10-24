# Použití AI

**Nástroj:** Claude Code (model Claude Opus) v terminálu.

**Na co:**

- Rozbor zadání a „grilování“ návrhu – AI kladla otázky po kolech s doporučenou odpovědí, rozhodnutí jsem dělal já. Výsledek je slovník pojmů (`CONTEXT.md`) a ADR.
- Profilování dat skripty (kódování, oddělovače, varianty kódů, duplicity, data v budoucnosti).
- Implementace doménové vrstvy, UI, unit a e2e testů, CI a nasazení.
- Návrh průvodního textu.

**Kde bylo nutné výstup opravit nebo zpochybnit:**

- AI původně hlásila v datech roky 4355, 4420, 4503 – ve skutečnosti jde o Excelová sériová čísla; ověřeno rozdílem s `platnost_do` (731 / 365 dní).
- Navrhla brát jako zdroj pravdy katalog; rozhodl jsem opačně (`platnost_do` ze záznamu má přednost, katalog se mohl změnit).
- Chtěla řádek s neexistujícím datem 31. 9. rovnou odmítnout; změnil jsem to na nesrovnalost, o které rozhodne HR (odmítají se jen strukturálně rozbité řádky).
- U tvrzení, že BOZP se musí absolvovat před nástupem, jsem si vyžádal zdroj (§ 103 odst. 2 zákoníku práce) a omezil ho jen na BOZP.
- Rozdíl mezi hladovým algoritmem a optimalizací jsem si nechal vysvětlit na konkrétním případu z dat (jediné volné místo na BOZP v říjnu).
- Načítání dat přes `useEffect` jsem nechal přepsat na TanStack Query.
- Testy psané AI selhaly kvůli chybám v testech samotných (špatný předpoklad o algoritmu, nejednoznačné lokátory, duplicitní `id` nadpisů dialogů); jeden z nich odhalil zbytečnou větev v algoritmu.
