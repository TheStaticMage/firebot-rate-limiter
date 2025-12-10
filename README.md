# Firebot Rate Limiter

## Introduction

This is a rate limiter to prevent particular effects from running too frequently in [Firebot](https://firebot.app). This is primarily intended to help avoid abuse, but it can also be used to implement advanced logic around cooldowns, maximum invocations per stream, etc.

Some of the things you can use this rate limiter to help with include:

- Limiting the number of times a user can run a command repeatedly in a short period of time
- Implementing cooldowns and/or usage limits on effects for which Firebot does not natively support cooldowns and/or usage limits

This script supplies the following:

- The `Rate Limiter: Check Request` effect, which is available for all events and effect lists. This is capable of stopping the effect list and/or setting effect outputs so you can take action.
- The `Rate Limit Exceeded` event, so you can run effects when rate limits are exceeded (this is optional and intended for advanced users)
- The ability to configure shared rate limiter buckets that are accessible from multiple effects

### How does the rate limiter work?

To understand how a rate limiter works in general, visualize the following:

- You have a pack of cookies and a bowl that has 20 marbles in it.
- In order to can eat a cookie, you need to take 5 marbles out of the bowl. (If there are fewer than 5 marbles in the bowl, you cannot have a cookie.)
- Every minute, you may replace 1 marble into the bowl, so long as there are never more than 20.

At the start, the bowl is full of marbles, and you can scarf down 4 cookies right away if you want to (20 / 5 = 4). But after that, you will have to wait a bit for there to be enough marbles in the bowl for you to have another cookie. If you eat a cookie immediately when there are enough marbles are available, you will have one cookie every 5 minutes after your initial burst. However, if you take a walk, the bowl slowly fills up with marbles, and you can once again eat several cookies when you get back.

This illustration demonstrates the [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm -- the bowl is the _bucket_ and the marbles are the _tokens_. You will configure the parameters of your bucket, such as how many tokens are present at the start and how fast tokens are replenished. You will then add the "Rate Limiter: Check Request" effect to the effect list of activities you want to limit, like running a command or sending a TTS message. This effect can stop the execution of the rest of the effect list if the limits are exceeded, or you can use its outputs to make decisions in future conditional effects.

The [tutorial](/doc/tutorial.md) implements the "cookies and marbles" example in Firebot.

## Documentation

- [Installation](/doc/installation.md)
- [Upgrading](/doc/upgrading.md)
- [Tutorial](/doc/tutorial.md)

## Installation

The plugin needs to be installed like any other Firebot startup script.

For detailed instructions, consult: [Installation](/doc/installation.md)

## Examples

### Tutorial

The [tutorial](/doc/tutorial.md) implements the "cookies and marbles" example from above.

### Persist cooldowns across streams / Firebot restarts

By default, the rate limiter resets all buckets when Firebot restarts. This means that if a viewer hit their rate limit right before you ended your stream, they would be able to immediately use that feature again when you start your next stream. For some use cases, you might want the rate limits to persist across sessions.

For example, if you have a special reward that can only be redeemed once per week, you would want that limit to persist even if Firebot restarts. Without persistence, a viewer could redeem it once per Firebot session rather than once per week.

To enable persistence for a bucket:

1. Ensure that advanced buckets are enabled. If you see a RATE LIMITER option in the left frame of Firebot, you're good. Otherwise, go to Settings > Scripts > Manage Startup Scripts, click Edit next to Rate Limiter, check Enable Advanced Buckets, and save. You may need to restart Firebot to get the RATE LIMITER option to show up after enabling it for the first time.

2. From the left frame, under "Custom", click on RATE LIMITER.

3. Create a new advanced bucket or edit an existing one. Check the "Persist bucket data across Firebot restarts" box.

4. Optionally, check the "Fill across Firebot restarts" box. This option controls what happens to the bucket while Firebot is not running. If checked, the bucket will continue to refill tokens even when Firebot is offline, so when you start Firebot again, it will be as if time kept passing. If unchecked, the bucket will remain frozen at whatever state it was in when Firebot shut down.

:bulb: _Tip: Use "Fill across Firebot restarts" for time-based cooldowns (like "once per week") but leave it unchecked for counter-based limits (like "3 times per stream")._

### Real-life example: Preventing over-notification of small bits cheers

On my stream, I have a cheer alert that plays a sound effect and shows an animation. This is great for normal cheers, but it becomes a problem when viewers send many small cheers in rapid succession. For example, if someone sends ten 1-bit cheers in a row, the sound effect would play 10 times, which gets annoying fast.

I still want to acknowledge all cheers of all sizes, but I want the sound to be rate limited based on the cheer amount. Specifically, I want larger cheers to have more "weight" in unlocking the sound, while small cheers should eventually cause the sound to stop playing until a larger cheer comes through or enough time passes.

Here's how I implemented this using the rate limiter:

#### Step 1: Create an advanced bucket

1. Ensure that advanced buckets are enabled. If you see a RATE LIMITER option in the left frame of Firebot, you're good. Otherwise, go to Settings > Scripts > Manage Startup Scripts, click Edit next to Rate Limiter, check Enable Advanced Buckets, and save. Restart Firebot if needed.

2. From the left frame, under "Custom", click on RATE LIMITER.

3. Add a new bucket with these settings: Start Tokens = 100, Max Tokens = 100, Refill Rate = 1 (this gives 1 token per minute of passive refill). Leave the persistence options unchecked. Save this bucket.

#### Step 2: Add effects to your cheer alert (in this order)

1. **Rate Limiter: Modify Bucket Data** - Set Bucket Type to Advanced and select the bucket you created in Step 1. Set Key Type to Custom with Key set to `$username`. Set Action to Modify, check "Create key if missing", set Current Token Operation to Add, and set Current Token Value to `$math[2 * $cheerBitsAmount]`. This adds tokens based on the cheer amount: a 1-bit cheer adds 2 tokens, a 50-bit cheer adds 100 tokens, and a 100-bit cheer adds 200 tokens.

2. **Rate Limiter: Check Request** - Set Bucket Type to Advanced and select the same bucket from step 1. Set Key Type to Custom with Key set to the username or unique identifier for the cheerer. Set Tokens Required to `$math[100 - $cheerBitsAmount]`. This means a 1-bit cheer deducts 99 tokens, a 50-bit cheer deducts 50 tokens, and a 100-bit cheer deducts 0 tokens (so it never depletes the bucket). Leave "Stop effect execution if limit exceeded" unchecked so the effect list continues regardless, and the rate limiter will set effect outputs that you can check later.

3. **Conditional Effects** - Checks if `$effectOutput[rateLimitAllowed]` is false. If the rate limit was exceeded, this conditional effect hides the cheer sound source in OBS and sends a chat message: "Mage appreciates cheers of all sizes, but the sound effect gets muted after too many small donations. Cheer at least 100 bits to unlock the sound again!"

4. The rest of the effect list continues normally, showing the visual alert regardless of whether the sound played.

The math works out so that small cheers gradually deplete the bucket (since they remove more tokens than they add), while larger cheers replenish it. In practice, this means the sound plays for the first several small cheers, but eventually stops until someone sends a larger cheer (100+ bits), or until enough time passes.

You can customize the threshold by changing the `100` in the formulas to whatever bit amount you want. For example, if you change it to `50`, then 50-bit cheers and above would always allow the sound to play immediately.

### Real-life example: Preventing over-use of TTS

Text-to-speech (TTS) is a popular feature on my stream, but without rate limiting, it can easily be abused. I provide a certain number of TTS uses per viewer type per stream. I want to let my subscribers use TTS more than random viewers, but I still don't want anyone to spam TTS endlessly. (My approach differs from many streamers who charge channel points or currency for each TTS message.)

I implemented role-based rate limiting for my TTS command, where each role has a different bucket configuration. The command uses conditional effects to check the user's role and apply the appropriate rate limit. Here's how it works:

**First, I block known abusers entirely:**

I created a custom role for serial abusers who have lost their privileges. A conditional effect checks if the user has this "TTS Banned" custom role. If they do, the effect list stops immediately and sends them a message explaining they're not permitted to use TTS.

**Then, I apply role-based rate limits:**

Using a conditional effect (with one "if" / "else if" section per tier), I check the user's role and run the appropriate **Rate Limiter: Check Request** effect. Each role has its own bucket with different parameters:

- **Broadcaster** (if condition): Bucket size 1, refill rate 1 token/second, 1 token required per use, maximum 420 uses per stream. This allows practically unlimited use, up to a total of 420 redemptions per stream. There's not really a reason to rate-limit yourself, but I do this to make sure the rate limiter is working.

- **Moderators** (else if condition): Bucket size 60, refill rate 1 token/second, 20 tokens required per use, maximum 10 uses per stream. This allows up to 3 uses per minute.

- **VIPs** (else if condition): Bucket size 60, refill rate 1 token/second, 45 tokens required per use, maximum 7 uses per stream.

- **Subscribers** (else if condition): Bucket size 120, refill rate 1 token/second, 90 tokens required per use, maximum 5 uses per stream.

- **Regular viewers** (otherwise condition): Bucket size 120, refill rate 1 token/second, 120 tokens required per use, maximum 2 uses per stream. This lets regular viewers use TTS twice per stream with a minimum of a 2 minute gap between messages.

All of these rate limiters use the "user" key type (so each user has their own bucket) and are configured to stop execution if the limit is exceeded. They also trigger the **Rate Limit Exceeded** event with metadata "tts", which allows me to send a custom message or log when someone hits their limit.

**Here's how my Rate Limit Exceeded event is configured:**

I have a **Rate Limit Exceeded** event (available when you use the rate limiter plugin) with a conditional effect that checks `$rateLimitMetadataKey` equals "tts". Inside that conditional, I have two "if" conditions that handle different rejection reasons:

1. **If `$rateLimitRejectReason` is "invocation_limit"** (user hit their per-stream maximum): Send a chat message saying "Sorry, `$rateLimitTriggerUsername`, but you have already used your `$rateLimitInvocationLimit` TTS messages this stream. See you next time!"

2. **Else if `$rateLimitRejectReason` is "rate_limit"** (user is going too fast but hasn't hit their maximum): Send a chat message saying "Woah, `$rateLimitTriggerUsername`, slow your roll! You can use TTS again in `$ceil[$rateLimitNext]` `$if[$ceil[$rateLimitNext] == 1, second, seconds]` and have $rateLimitRemaining `$if[$rateLimitRemaining == 1, message, messages]` left."

3. **Else** (any other error): Send a chat feed alert with the error details for debugging.

This gives users clear feedback about why their TTS was rejected and when they can use it again. The rate limiter provides helpful replace variables like `$rateLimitTriggerUsername`, `$rateLimitNext` (seconds until next allowed use), `$rateLimitRemaining` (usages remaining until they reach the max limit), and `$rateLimitInvocationLimit` (total allowed per stream).

The combination of refill rate, bucket size, and invocation limit gives me fine-grained control. The refill rate and bucket size control the short-term rate (preventing spam), while the invocation limit allows me to reward my most loyal viewers while still keeping TTS usage reasonable during each stream.

:bulb: _Tip: When setting up role-based limits like this, start with conservative limits and loosen them based on how your community behaves. It's easier to make limits more generous than to tighten them after viewers get used to lenient limits._

### Real-life example: Shared rate limit for multiple events

To make sure I don't miss chat messages, I had Firebot configured to play a sound when someone posts a chat message on Twitch. I set up the rate limiter so that this sound plays at most once every 5 seconds so it's not playing the sound continuously during periods of high activity. That setup looked like this:

- Event: **Chat Message (Twitch)**
- Filters:
  - **Viewers Roles** / Doesn't include / Streamer
  - **Viewers Roles** / Doesn't include / Stream Bot
- Effects:
  - **Rate Limiter: Check Request**: Bucket size = 5, Refill rate = 1, Key = Global, Stop effect execution if limit exceeded
  - **Play sound**: A "ding" sound routed only to my headphones

Recently I set up the [Firebot Kick Integration](https://github.com/TheStaticMage/firebot-mage-kick-integration) which has a separate chat event for Kick. However, if I just copied this same setup to the Kick event, the chat notification sounds would not be coordinated with each other. To address this, I can use an advanced bucket and the "Rate Limit Approved" event.

1. Ensure that advanced buckets are enabled. If you see a RATE LIMITER option in the left frame of Firebot, you're good. Otherwise, go to Settings > Scripts > Manage Startup Scripts, click Edit next to Rate Limiter, check Enable Advanced Buckets, and save. Restart Firebot if needed.

2. From the left frame, under "Custom", click on RATE LIMITER. Add a new bucket with these settings: Start Tokens = 5, Max Tokens = 5, Refill Rate = 1, and none of the other options checked. Save this bucket. (This is one allowed execution per 5 seconds.)

3. For this step, you may create a new **Chat Message (Twitch)** event, or modify an existing event. In either case, add the **Rate Limiter: Check Request** effect with these settings: Bucket Type = Advanced, Bucket = _the bucket you created in step 2_, Key = Global, Tokens required = 5. From the options, check the _Trigger the 'Rate Limit Approved' event if approved_ box. (Note: You do NOT put the "Play Sound" effect in this list. We'll add that in a bit.)

4. Repeat the previous step for any additional events that you want to use this shared rate limit.

5. Create a new event of type **Rate Limit Approved**. Add a filter: **Rate Limiter Bucket** = _the bucket you created in step 2_. And then add any effect(s) -- in my case, it was the "Play Sound" effect, but this can be whatever you want.

Now, whenever _either_ of the two trigger events happens, the same 5 second rate limit will apply. As an added bonus, you have only defined your "Play Sound" effect in one place, so if you add additional trigger events, you will effectively be using the same effect list to handle it.

## Support

The best way to get help is in my Discord server. Join the [The Static Discord](https://discord.gg/hw32MM2Qxq) and then visit the `#firebot-rate-limiter` channel there.

- Please do not DM me on Discord.
- Please do not ask for help in my chat when I am streaming.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/TheStaticMage/firebot-rate-limiter/issues).

## Contributing

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-rate-limiter/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

## License

This plugin is released under the [GNU General Public License version 3](/LICENSE). That makes it free to use whether your stream is monetized or not.

If you use this on your stream, I would appreciate a shout-out. (Appreciated, but not required.)

- <https://www.twitch.tv/thestaticmage>
- <https://kick.com/thestaticmage>
- <https://youtube.com/@thestaticmagerisk>

## FAQ

### How is this different from cooldowns or maximum usage counts?

Cooldowns and maximum usage counts are special cases of rate limits and can be modeled by this rate limiter if you want to. The rate limiter allows more flexibility (as noted in the [Examples](#examples)) that goes beyond the basic cooldowns and maximum usage counts supported by Twitch and Firebot. However, if you can do everything you need with functionality that is natively present in Firebot, then you should do so!
