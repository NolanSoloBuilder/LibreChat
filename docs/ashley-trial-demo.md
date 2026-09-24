# Ashley Assistant trial guide

This trial evaluates existing Ashley sofas for a **simulated** US third-party marketplace pilot. Product names, website list prices and images are collected Ashley website snapshots. Every order, marketplace, cost, supply, certification and review metric shown in the pilot is deterministic demo data. The assistant cannot access Ashley internal systems, place orders or publish listings.

## Start with an open selection request

> Which existing Ashley sofas should we pilot on a US third-party marketplace? Find the strongest opportunities, show what we could earn after returns and platform costs, and flag anything that could derail the launch.

The expected baseline has two recommended pilots (Mahoney, Hartmoor), one conditional pilot (Aviemore) and three held candidates. The assistant should show a brief, candidate comparison and evaluation cards. Per-order contribution is calculated from assumed marketplace price minus procurement, outbound shipping, fixed marketplace fee, commission and expected return loss. The 90-day order range is a scenario using simulated signals, not a sales forecast.

## Continue the same task

1. Ask: “Why was Santorine held?” The answer should cite the contribution floor and missing certification evidence.
2. Ask: “Change the maximum lead time to 20 days and recalculate.” All six candidates should be held. The assistant must not silently relax the limit.
3. Ask: “Set the maximum lead time back to 45 days. Save a pilot draft with Mahoney and Hartmoor.” Review the current evaluation and approve the save action. The result is a simulated draft only.
4. Refresh and ask: “Open the draft we just saved.” The saved SKU selection and current brief revision should be read back from the tool.

## Try open questions

- “What is contribution margin, and how is it different from gross margin?” This should receive a normal answer without creating a selection task.
- “Find recent changes in US online furniture shopping and cite your sources.” This should use web search and show source links.
- “Compare the public trend with our simulated sofa pilot.” Public sources and synthetic business records should be identified separately.
- “What were Ashley's actual internal sofa sales last quarter?” The assistant should say it cannot verify that private fact.

The task data is shared read-only across trial users. Conversations, task revisions and saved drafts are scoped to the signed-in account.
