# Firebot Rate Limiter

## Introduction

This is a rate limiter to prevent particular effects from running too frequently in Firebot. This is primarily intended to help avoid abuse, but it can also be used to implement advanced logic around cooldowns, maximum invocations per stream, etc.

Some of the things you can use this rate limiter to help with include:

- Limiting the number of times a user can run a command repeatedly in a short period of time
- Implementing cooldowns and/or usage limits on effects for which Firebot does not natively support cooldowns and/or usage limits

### How does the rate limiter work?

To understand how a rate limiter works in general, visualize the following:

- You have a pack of cookies and a bowl that has 20 marbles in it.
- In order to can eat a cookie, you need to take 5 marbles out of the bowl. (If there are fewer than 5 marbles in the bowl, you cannot have a cookie.)
- Every minute, you may replace 1 marble into the bowl, so long as there are never more than 20.

At the start, the bowl is full of marbles, and you can scarf down 4 cookies right away if you want to (20 / 5 = 4). But after that, you will have to wait a bit for there to be enough marbles in the bowl for you to have another cookie. If you eat a cookie immediately when there are enough marbles are available, you will have one cookie every 5 minutes after your initial burst. However, if you take a walk, the bowl slowly fills up with marbles, and you can once again eat several cookies when you get back.

This illustration demonstrates the [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm -- the bowl is the _bucket_ and the marbles are the _tokens_. You will configure the parameters of your bucket, such as how many tokens are present at the start and how fast tokens are replenished. You will then add the "Rate Limiter: Check Request" effect to the effect list of activities you want to limit, like running a command or sending a TTS message. This effect can stop the execution of the rest of the effect list if the limits are exceeded, or you can use its outputs to make decisions in future conditional effects.

## Installation

1. From the latest [Release](https://github.com/TheStaticMage/firebot-rate-limiter/releases), download `Firebot-Rate-Limiter-<version>.js` into your Firebot scripts directory (File &gt; Open Data Folder, then select the "scripts" directory).

    :warning: If you are upgrading from a prior version, delete any older versions of this script.

2. Enable custom scripts in Firebot (Settings &gt; Scripts).

3. Add the `Firebot-Rate-Limiter-<version>.js` script that you just added as a startup script (Settings &gt; Scripts &gt; Manage Startup Scripts &gt; Add New Script).

    :warning: If you are upgrading from a prior version, delete any references to the older versions.

4. Restart Firebot.

## Usage

This script supplies the following:

- The `Rate Limiter` configuration UI, shown in the left frame of Firebot
- The `Rate Limiter: Check Request` effect, which is available for all events and effect lists
- The `Rate Limit Exceeded` event, so you can run effects when rate limits are exceeded (this is optional and intended for advanced users)
- Several custom variables that are available only for the `Rate Limit Exceeded` event

## Tutorial

This tutorial will guide you through creating a preset effect list that demonstrates the use of the rate limiter. This tutorial will allow you to post at most 3 messages into your Firebot chat feed during a rolling 10 second window. As you go through this tutorial, keep in mind that you can add the rate limiter just about anywhere (effect lists, commands, events, etc.).

1. In the left frame, under **Custom**, click RATE LIMITER.

2. Click **Add New Bucket** and configure it with these settings:

    - Bucket Name: `Tutorial Bucket`
    - Start Tokens: `10`
    - Max Tokens: `10`
    - Refill Rate: `1`
    - [ ] Lifetime Max Tokens - Unchecked
    - [ ] Fill from start - Unchecked
    - [ ] Persist bucket data across Firebot restarts - Unchecked

    When you're done, click **Save**.

3. In the left frame, under **Triggers**, select PRESET EFFECT LISTS.

4. Click **New Preset Effect List** at the top of the screen.

    - Name the list "Rate Limiter Tutorial".

5. Under **Effects**, click the _Add New Effect_ link. In the search bar, type "rate" to filter, and select `Rate Limiter: Check Request`. Then press the **Select** button.

6. Configure the effect as follows:

    - Bucket: Choose `Tutorial Bucket` created in the prior step
    - Key: [x] User
    - Tokens:
        - Tokens required: `3`
        - [ ] Inquiry only - Unchecked
    - Options:
        - [x] Enforce limit for streamer - Checked
        - [x] Enforce limit for bot - Checked
        - [x] Stop effect execution if limit exceeded - Checked
          - [ ] Bubble the stop effect execution request to all parent effect lists - Unchecked
        - [ ] Set a maximum number of times this can be successfully invoked - Unchecked
        - [ ] Trigger the 'Rate Limit Exceeded' event if exceeded - Unchecked

    When you're done, click **Add**.

7. Under **Effects**, click the _Add New Effect_ link. In the search bar, type "feed" to filter, and select `Chat Feed Alert`. Then press the **Select** button.

8. Configure the alert message as follows (copy and paste):

    ```text
    Hello, world!
    ```

    When you're done, click **Add**.

9. Click **Save** to save the preset effect list.

10. In the list of all preset effects, find the "Rate Limiter Tutorial" entry. It should be at the bottom of the list.

11. Click the &#9658; icon (Test Effects) quickly 5 times.

12. Click DASHBOARD from the left frame. You should see 5 messages there that look like this:

    ```
    Hello, world!
    Hello, world!
    Hello, world!
    ```

    Note that this only showed up 3 times, even though you clicked the button 5 times. That is because the 4th and 5th times you clicked, you were rate limited.

    If you would like to experiment a bit more before moving on, here are some things you can try:

    - Click the &#9658; icon steadily once per second for about 20 seconds. This should result in you seeing about 6 messages.

    - Click the &#9658; icon as fast as you can for about 20 seconds. This should also result in you seeing about 6 messages.

13. Edit the "Tutorial" preset effect list and click on the Rate Limiter: Check Request effect. Leave everything the same as before (from step 6), except uncheck the _Stop effect execution if limit exceeded_ box.

14. Also edit the Chat Feed Alert on the preset effect list. Configure the alert message as follows (copy and paste):

    ```text
    Rate Limiter tutorial: allowed=$effectOutput[rateLimitAllowed] next=$ceil[$effectOutput[rateLimitNext]] error=$effectOutput[rateLimitErrorMessage]
    ```

15. Once again, click the &#9658; icon 5 times quickly.

16. Return to the DASHBOARD. You should see 5 messages there that look like this:

    ```
    Rate Limiter tutorial: allowed=true next=0 error=
    Rate Limiter tutorial: allowed=true next=0 error=
    Rate Limiter tutorial: allowed=true next=2 error=
    Rate Limiter tutorial: allowed=false next=2 error=Insufficient tokens (has 1.5170000000000003, needs 3)
    Rate Limiter tutorial: allowed=false next=2 error=Insufficient tokens (has 1.7200000000000004, needs 3)
    ```

    - `$effectOutput[rateLimitAllowed]` is either true or false, for whether the request was allowed. (If you don't use the built-in option to stop effect execution, you will need to set up your own conditional effect to check if `$effectOutput[rateLimitAllowed]` is `true` before allowing an action.)

    - `$effectOutput[rateLimitNext]` is the number of seconds until the same request will be successful. On the first two clicks, this was 0, because the request could be immediately tried again. On the third click, this was 2, because the bucket was nearly empty. On the fourth and fifth messages, this was either 2 or 1, depending on how quickly you clicked.

    - `$effectOutput[rateLimitErrorMessage]` is an internal error message when the rate limit request is rejected. This might be useful to display to yourself (e.g. as a chat feed alert or in a log message) but is generally not intended to be shared with users.

    :bulb: There are other effect outputs available. From the screen where you are editing the Rate Limiter: Check Request effect, click on the "Outputs" link to see these. Mouse over the **?** icons for an explanation of each.

## Examples

### Cooldown

:bulb: _Many Firebot components support cooldowns. If you can achieve what you need via native Firebot functionality, you generally should. This example is provided for educational purposes only._

### Limit per stream

:bulb: _Many Firebot components support limits. If you can achieve what you need via native Firebot functionality, you generally should. This example is provided for educational purposes only._

### Real-life example: Preventing over-notification of small bits cheers

### Real-life example: Preventing over-use of TTS

## Support

The best way to get help is in this project's thread on Discord. Join the [Crowbar Tools Discord](https://discord.gg/crowbartools-372817064034959370) and then visit the [thread for Firebot Rate Limiter]() there.

  - Please do not DM me on Discord.
  - Please do not ask for help in my chat when I am live on Twitch.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/TheStaticMage/firebot-rate-limiter/issues).

## Contributing

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-rate-limiter/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

## License

This script is released under the [GNU General Public License version 3](/LICENSE). That makes it free to use whether your stream is monetized or not.

If you use this on your stream, I would appreciate a shout-out. (Appreciated, but not required.)

- <https://www.twitch.tv/thestaticmage>

## FAQ

### How is this different from cooldowns or maximum usage counts?

Cooldowns and maximum usage counts are special cases of rate limits and can be modeled by this rate limiter if you want to. The rate limiter allows more flexibility (as noted in the [Examples](#examples)) that goes beyond the basic cooldowns and maximum usage counts supported by Twitch and Firebot. However, if you can do everything you need with functionality that is natively present in Firebot, then you should do so!
