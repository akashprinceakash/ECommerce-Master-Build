---
name: CustomizeEntryModal product source
description: Modal uses useListProducts (live API) to build its carousel — no hardcoded IDs except solid fallback.
---

The CustomizeEntryModal previously had hardcoded product IDs and mismatched design overrides (e.g. product 32 = KS1002B-BB but was linked as KS1005B). This caused different behaviour between the modal and product page.

**Fix applied:** Import useListProducts + getListProductsQueryKey; filter by parseSku().type; pattern hrefs use /products/{id}/customize with NO style override so the studio reads the real product SKU.

**Solid card special case:** No KS1000B-XX solid-SKU product exists in the DB. The solid card uses the first available pattern product as the 3D model base, with ?style=solid&design=KS1000BPOWDERBLUE override. If a solid product is added to the DB, this card should be updated to use parseSku().type === "solid" filter instead.

**Why:** Both the modal and product page must navigate to the same /products/{id}/customize URL to guarantee identical studio behaviour.
