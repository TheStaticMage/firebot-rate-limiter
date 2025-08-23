# Firebot Rate Limiter

## Introduction

This is a rate limiter to prevent particular effects from running too frequently in Firebot. This is primarily intended to help avoid abuse, but it can also be used to implement advanced logic around cooldowns, maximum invocations per stream, etc.

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

## Installation

The script needs to be installed like any other Firebot startup script.

For detailed instructions, consult: [Installation](/doc/installation.md)

## Examples

### Tutorial

The [tutorial](/doc/tutorial.md) implements the "cookies and marbles" example from above.

### Cooldown

:bulb: _Many Firebot components support cooldowns. If you can achieve what you need via native Firebot functionality, you generally should. This example is provided for educational purposes only._

### Limit per stream

:bulb: _Many Firebot components support limits. If you can achieve what you need via native Firebot functionality, you generally should. This example is provided for educational purposes only._

### Persist cooldowns across streams / Firebot restarts

:bulb: _I do not believe that Firebot can natively do this._

- Create an advanced bucket in the RATE LIMITER tab from the left frame
- Check the "Persist bucket data across Firebot restarts" and "Fill across Firebot restarts" boxes.

### Real-life example: Preventing over-notification of small bits cheers

### Real-life example: Preventing over-use of TTS

## Support

The best way to get help is in my Discord server. Join the [The Static Discord](https://discord.gg/hw32MM2Qxq) and then visit the `#firebot-rate-limiter` channel there.

- Please do not DM me on Discord.
- Please do not ask for help in my chat when I am live on Twitch.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/TheStaticMage/firebot-rate-limiter/issues).

## Contributing

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-rate-limiter/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

## License

This script is released under the [GNU General Public License version 3](/LICENSE). That makes it free to use whether your stream is monetized or not.

If you use this on your stream, I would appreciate a shout-out. (Appreciated, but not required.)

- <https://www.twitch.tv/thestaticmage>
- <https://kick.com/thestaticmage>
- <https://youtube.com/@thestaticmagerisk>

## FAQ

### How is this different from cooldowns or maximum usage counts?

Cooldowns and maximum usage counts are special cases of rate limits and can be modeled by this rate limiter if you want to. The rate limiter allows more flexibility (as noted in the [Examples](#examples)) that goes beyond the basic cooldowns and maximum usage counts supported by Twitch and Firebot. However, if you can do everything you need with functionality that is natively present in Firebot, then you should do so!
