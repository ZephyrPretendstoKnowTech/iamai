# Owner review of roadmap flow proposal V1 (2026-09-23, verbatim)

Your decision answers:

1. Let's hold off on removing the "Show completed" and "Show deferred", just for a bit. We can remove them later. I want to see the final product before we remove those views, just incase. On the view board, previously it read "Ready | Up Next | On Hold | All Work". We should move "All Work", to the left side, since that's typical UI for the default view.
2. I like less sections, so 8 instead of 10 is good. I wonder if 8 is too many still. I'll review them, and give my thoughts. What I wouldn't do, is change the naming for each of those sections. I'd reuse existing names when possible, or create new ones based off of the old naming convention for sections. For example, I liked the "Establish Emergency Access" name for the first column. Even if we change it, it should still sound technical, and not "Getting you back in" or whatever it is.
3. Sounds good. Will review.
4. Sounds good. Does Jon Hope have something in his baseline for how he suggests handling traveling users? Just wanting to make sure we don't weaken the deployment of the baseline. If this item is handled a different way, all good. Just double check, no need to 'invent' a solution if one is not needed.
5. Sounds good.
6. Sounds good. One point, Trusted network still needs to ask the user if they all work remote or have a VPN network. If they don't, yeah- we shouldn't make them try to fill one in. We shouldn't assume they do or do not have a network though. Tell me if you disagree.
7. Sounds good to me. Interested to see how you present this, with the progress bar at the top of each step with more than one policy in a step.
8. Sounds good.
9. Nobody besides me is using this tool. I'm fine nuking my old plan data and starting from a fresh scan/plan. No need to worry about cutting users over from the old method. Really. Just focus on net-new user experience, and no credence or time spent on converting old data.

The view:

Sections never move, but we should make sure the Ready, Up Next, and On Hold tabs still work. Unless you feel they aren't worthwhile anymore, after a change like this. Keep them for now, but if they become useless, then we'll cut them. Even if you think cutting them is best.

For the Finished work shrinks in place, my thought was to make sure the entire section is shrunken to just the section with a 0 / x remaining or something like that. Not sure if that's doable or valuable. That was my initial thought, not something I'm married to. Consider it, and discard it if you have something better and think I'll like what you've got for me.

The proposed roadmap:

The name for section 2 could use some work. Something about "Decide Your Tenant's Direction", just doesn't sound nice. No true suggestions, but consider. Maybe you can think of something better while keeping the tone?

Section 3 and 5 are heavy. Any chance we can shrink it? We can ONLY shrink it, if we truly can provide a quality, organized experience with less. Don't shrink just because I say so, but only if you see legitimate value in consolidating a step or two elsewhere, and see no circumstance where value is lost or one step becomes too demanding. Just a thought.

Maybe 3.1 can present a list of active accounts (NOT shared mailboxes or other accounts that don't actually get signed in to), that have no sign-in logs in 30 days, or something? Any other ideas where we can help generate a smart finding list for users to have an easier time tracking down dormant accounts? If this feature would take more than 30 minutes to build, let's put that as a v1.1 feature, and not add it to the v1.0 deployment we're shooting for this week. It's 9:00 AM on Wednesday, when I wanted to deploy this Monday morning after all. This is my last week I can dedicate this much time to all of this.

Per-User MFA is something that is not often used anymore in my experience, and most newer tenants won't even have to deal with it. Could we just straight up delete 4.6, and if not- is there a way we can present it only if necessary for the tenant?

Should there be a place where we say "Hey, your tenant has x licensing. which means y features have been excluded from the plan, as they require z licensing."

So that when people who have Business Premium use the baseline, finish it all the way, they don't think they are 100% compliant to Jon's baseline, but to the features they have available? Not sure the best way to state this or present it later. Maybe we don't need a big statement at the front, but just the ability to view features they don't have with an explanation why? Open to thoughts.

Also, is there a way where we help the users create ALL of the policies in report-only immediately? Then have them turn them on in the correct order/after enough time?

Or is the artificial boundaries where they have to get to Section 6 before they create the countries report-only policy beneficial?

Maybe a step somewhere that says, "Create all policies in Report-Only immediately, so you have the sign-in data you need later", idk. Just thoughts. There could be risks to this I know, but if it speeds up deployment from a few months to a few weeks, maybe?

This whole plan though looks REALLY good. Best I've seen so far. Is there anything else at a glance I might be missing you think I should take a look at, before I regret the direction because I missed a thing?
