TITLE: Making it to Newspaper Headlines: How I Coded My Way into Newspaper Headlines as a Teen Developer
DATE: 2024-11-18
TAGS: Teen Developer, Entrepreneurship, Community Impact, Mobile App Development, Success Story
IMAGE: https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiyv2iMhiYRFWa9eAuR3gKP41AehtCmyq29unS_QomrHS70U2AQTbFJAuWF3_UK2GMiY4vCy9jOtf6W_bqy7nU3IGxGAZcFEOixK9BIugJWJjOYk-Zf-1ADbSrkfPfdeXO7l7bU9w29Bfeylt2hKc9bwMdW4vkbtAHVAThYD8WbrIMQ5ICvazvipqb0p1Q/w151-h151/Blog%20Image%20(2).png

# The App That Put a 19-Year-Old in the Newspaper (And Why the Headlines Weren't the Point)

What does it take to get your photo in the newspaper? Growing up, I thought the answer was exam scores. Every year, the local papers would publish those massive grids of "Top Scorers" — tiny passport photos arranged in rows, barely distinguishable from each other. I'd find myself in there sometimes, one face among dozens. It felt like being famous and invisible at the same time.

Then, on Valentine's Day 2018, I got my own headline. Not for scoring well on a test. For building a matrimonial app. At 19.

## The Problem Nobody Was Solving

Here's the thing about my community — the Lingayath Shivasimpi community in Karnataka. Marriage is a big deal. Not just emotionally, but logistically. Families want to find matches within the community, across cities, with specific preferences. For decades, this happened through word of mouth, community gatherings, and newspaper classifieds.

It worked. Slowly. Imperfectly. But it worked.

I didn't set out to disrupt anything. I was 18, learning Android development, and looking for a real problem to solve. My father was an active member of the community, and during one of their gatherings, a discussion came up — could someone build an app for finding matches within the community? The kind of thing other communities already had, but ours didn't. Word got around that I was learning to code, and that's when the community leaders approached me directly. Could I build it?

I said yes before I fully understood what I was agreeing to.

## Building "Pink" on Nothing

I called it Pink. Not my choice, actually — one of the community leaders recommended the name and insisted on keeping it. I didn't argue. I was 18 and building my first real app; naming it was the least of my worries. The budget was effectively zero. No cloud infrastructure. No backend team. No design system. Just me, Android Studio, and a lot of late nights.

The technical decisions were driven entirely by constraints. I couldn't afford servers, so I used Firebase's free tier. I couldn't afford a designer, so I kept the UI simple — cards with photos, basic filters, a messaging system. I couldn't afford to test on multiple devices, so I tested on my phone and my father's phone and hoped for the best.

Looking back, the constraints were a gift. They forced me to build exactly what was needed and nothing more. No recommendation algorithms. No swipe mechanics. No gamification. Just profiles, search, and contact. The community didn't need Tinder. They needed a digital version of the community bulletin board.

## The Part I Didn't Expect

The app launched quietly. I shared it in community WhatsApp groups. My father told people at gatherings. Within weeks, something unexpected happened — elderly community members started using it. Not just browsing. Actively creating profiles for their children, searching for matches, reaching out to families.

I'd built the app thinking young people would use it. Instead, it was parents and grandparents who adopted it most enthusiastically. They'd call me — literally call my phone — to ask how to upload a photo or change a filter. I became accidental tech support for an entire generation of users I hadn't designed for.

That taught me something I couldn't have learned from any tutorial: the people who need your product most aren't always the people you imagined using it. I'd been thinking about users as "young professionals looking for matches." The actual users were "parents who wanted to help their children but didn't know how to navigate the modern world of matchmaking."

## February 14, 2018

The newspaper feature happened because a local journalist heard about a teenager building an app for the community. The story wasn't really about the technology — it was about a 19-year-old bridging tradition and modernity. The headline was something about "youngest developer" and "community service." My photo was there, solo this time. Not in a grid of achievers.

My phone blew up. Messages from relatives I hadn't spoken to in years. Friends sending screenshots. My mother bought five copies of the newspaper.

It felt good. I won't pretend it didn't. But here's what I remember more vividly than the headline: the week before, an elderly man from the community called to tell me his daughter had found a match through the app. He was crying. Not because of technology. Because his daughter, who lived in a different city and had limited community connections, had found someone compatible. The app had done what word of mouth couldn't.

That phone call mattered more than the newspaper. It still does.

## What Pink Became

The app evolved. It eventually became Rishtas.in — a fully serverless platform running on GitHub CDN, Google AppScripts, Firebase, and Mail APIs. Zero operating cost. Over 1,000 active community members. No venture funding. No monetization. Just a tool that works for people who need it.

The architecture is almost comically simple by modern standards. Static hosting on GitHub. Form submissions through Google AppScripts. Data in Firebase. Email notifications through free mail APIs. The entire thing costs nothing to run. I sometimes wonder if that's its greatest technical achievement — not what it does, but what it doesn't need.

## The Rush That Never Left

People ask me why I kept building after Pink. The honest answer is the feeling. Not the newspaper feeling — the phone call feeling. The moment when something you made with your hands solves a problem for someone you've never met. That's addictive in a way that no headline can match.

Every project I've built since carries the same question: who is this actually for, and what do they actually need? Not what's technically interesting. Not what looks good on a resume. What solves a real problem for a real person?

I was 18 when I learned that lesson. I'm still learning it.

If you're a young developer wondering whether your skills matter — they do. But not because of what you can build. Because of who you can help. The technology is just the vehicle. The destination is always a person on the other end, trying to solve a problem they couldn't solve alone.

What problem are you close enough to see that nobody else is solving?
