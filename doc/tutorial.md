# Tutorial

This tutorial will guide you through the "cookies and marbles" example from the [Introduction](/README.md#how-does-the-rate-limiter-work). Recall the setup, although for the sake of expediency, we will use _seconds_ rather than _minutes_ as the time unit for refilling the marble bowl.

- You have a pack of cookies and a bowl that has 20 marbles in it.
- In order to can eat a cookie, you need to take 5 marbles out of the bowl. (If there are fewer than 5 marbles in the bowl, you cannot have a cookie.)
- Every ~minute~ second, you may replace 1 marble into the bowl, so long as there are never more than 20.

We can model this in Firebot as a Preset Effect List. Although this is not as tasty as a cookie, it will have to do.

## Basic Tutorial

This tutorial configures the effect to stop the effect list if it is rate limited.

1. In the left sidebar, click PRESET EFFECT LISTS.

2. Click **New Preset Effect List** at the top of the screen.

    - You may name the list "Cookie Tutorial" (or whatever you want).

3. Under **Effects**, click the _Add New Effect_ link.

    - In the search bar, type "rate" to filter, and select `Rate Limiter: Check Request`. Then press the **Select** button.

    - Configure the effect as follows:
        - Bucket:
            - Bucket Size: 20
            - Refill Rate (tokens/sec): 1
        - Key:
            - [x] User - Checked
        - Tokens:
            - Tokens required: `5`
            - [ ] Inquiry only - Unchecked
        - Options:
            - [x] Enforce limit for streamer - Checked
            - [x] Enforce limit for bot - Checked
            - [x] Stop effect execution if limit exceeded - Checked
            - [ ] Bubble the stop effect execution request to all parent effect lists - Unchecked
            - [ ] Set a maximum number of times this can be successfully invoked - Unchecked
            - [ ] Trigger the 'Rate Limit Exceeded' event if exceeded - Unchecked

        When you're done, click **Add**.

4. Still under **Effects** in your new preset effect list, click the _Add New Effect_ link.

    - In the search bar, type "feed" to filter, and select `Chat Feed Alert`. Then press the **Select** button.

    - Configure the alert message as follows:

        ```text
        Ate a cookie at $date[YYYY-MM-DD HH:mm:ss]!
        ```

        When you're done, click **Add**.

5. Click **Save** to save the preset effect list.

6. In the list of all preset effects, find the "Cookie Tutorial" entry. It should be at the bottom of the list. Click the &#9658; icon (Test Effects) quickly 10 times.

7. Click DASHBOARD from the left frame. You should see 4 messages there that look like this:

    ```text
    Ate a cookie at 2025-07-13 15:24:13!
    Ate a cookie at 2025-07-13 15:24:13!
    Ate a cookie at 2025-07-13 15:24:13!
    Ate a cookie at 2025-07-13 15:24:14!
    ```

    Note that this only showed up 4 times, even though you clicked the button many more times than that. That is because the 5th and subsequent times you clicked, you were rate limited.

    If you would like to experiment a bit more before moving on, here are some things you can try:

    - Click the &#9658; icon steadily once per second for about 20 seconds. You will see the first 4 cookies eaten all at once, and then each subsequent cookie eaten 5 seconds apart.

    - Click the &#9658; icon as fast as you can for about 20 seconds. The results will be the same as the prior experiment! You will see the first 4 cookies eaten all at once, and then each subsequent cookie eaten 5 seconds apart.

## Intermediate Tutorial

You do not always need to stop execution of the effect list when the rate limit is exceeded. The `Rate Limiter: Check Request` provides several effect outputs which you can do to make decisions down the line. This tutorial shows you how to use those, together with a conditional effect, to handle both cases.

1. Duplicate the preset effect list that you created in the previous tutorial, or repeat steps 1-5 of the previous tutorial to create the starting point for this tutorial.

2. Edit the preset effect list, and then edit the `Rate Limiter: Check Request` effect (which should be at the top of the list).

    - Uncheck the "Stop effect execution if limit exceeded" option.
    - Leave all other options the same.
    - Click the **Save** button.

3. Under **Effects**, click the _Add New Effect_ link.

    - In the search bar, type "condition" to filter, and select `Conditional Effects`. Then press the **Select** button.

    - Configure the conditions within the "If" section as follows:

        - Click **+** to add a new condition.
        - Change Type to **Custom**.
        - Enter this in the upper text box: `$effectOutput[rateLimitAllowed]`
        - Ensure that Comparator is **is**.
        - Enter this in the lower text box: `true`
        - Click **Save**.

    - Configure the effects within the "If" section as follows:

        - Click the _Add New Effect_ link.
        - In the search bar, type "feed" to filter, and select `Chat Feed Alert`. Then press the **Select** button.
        - Configure the alert message as follows:

            ```text
            Conditionally ate a cookie at $date[YYYY-MM-DD HH:mm:ss]!
            ```

        - When you're done, click **Add**.

    - Configure the effects within the "Otherwise" section as follows:

        - Click the _Add New Effect_ link.
        - In the search bar, type "feed" to filter, and select `Chat Feed Alert`. Then press the **Select** button.
        - Configure the alert message as follows:

            ```text
            Failed to eat a cookie at $date[YYYY-MM-DD HH:mm:ss]! Try again in $effectOutput[rateLimitNext] sec.
            ```

        - When you're done, click **Add**.

    - Click the **Save** button.

4. Delete the previous "Chat Feed Alert" that you created in the previous tutorial. (Having this present will just confuse the output.)

5. In the list of all preset effects, find the "Cookie Tutorial" entry. It should be at the bottom of the list. As before, click the &#9658; icon (Test Effects) quickly 10 times.

6. Click DASHBOARD from the left frame. The messages should now look like this:

    ```text
    Conditionally ate a cookie at 2025-07-13 15:52:37!
    Conditionally ate a cookie at 2025-07-13 15:52:37!
    Conditionally ate a cookie at 2025-07-13 15:52:37!
    Conditionally ate a cookie at 2025-07-13 15:52:38!
    Failed to eat a cookie at 2025-07-13 15:52:38! Try again in 4.333000000000002 sec.
    Failed to eat a cookie at 2025-07-13 15:52:38! Try again in 4.152000000000002 sec.
    Failed to eat a cookie at 2025-07-13 15:52:38! Try again in 3.9800000000000018 sec.
    Failed to eat a cookie at 2025-07-13 15:52:38! Try again in 3.8080000000000016 sec.
    Failed to eat a cookie at 2025-07-13 15:52:38! Try again in 3.636000000000002 sec.
    Failed to eat a cookie at 2025-07-13 15:52:38! Try again in 3.463000000000002 sec.
    ```
