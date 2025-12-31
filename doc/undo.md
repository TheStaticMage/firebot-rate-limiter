# Undoing Rate Limit Checks

## Overview

The undo feature lets you reverse a rate limit check within 10 minutes. When you undo a check, the plugin restores the tokens consumed and decrements the invocation count.

## When to Use Undo

You might want to undo a rate limit check in these situations:

- A user accidentally triggers a command
- You need to cancel an action based on a later condition
- Testing and debugging rate limit configurations

## How It Works

When a rate limit check passes, it generates a unique approval ID. You can use this ID with the undo effect to reverse the check. Each approval ID expires after 10 minutes and can only be used once.

## Method 1: Using Effect Output (Recommended)

This method uses the approval ID directly from the check effect output.

### Setup Steps

1. Add a rate limit check effect to your effect list
2. Configure the check effect with your desired bucket and token settings
3. Add a rate limiter undo effect to your effect list
4. In the undo effect, set the **Approval ID** field to `$effectOutput[rateLimitApprovalId]`

### Example

This example shows an immediate undo (not practical, but demonstrates the mechanics):

```text
Effect List:
1. Rate Limiter: Check Request
   - Bucket: my-bucket
   - Tokens: 10

2. Rate Limiter: Undo Check
   - Approval ID: $effectOutput[rateLimitApprovalId]
```

When this effect list runs:

1. The check effect consumes 10 tokens and outputs the approval ID
2. The undo effect immediately reverses it, restoring the 10 tokens

## Method 2: Using Event and Replace Variable

This method uses the approval ID from the approved event.

### Setup Steps

1. Add a rate limit check effect
2. Enable **Trigger the 'Rate Limit Approved' event if approved** in the check effect
3. Create an event handler for the **Rate Limit Approved** event
4. Inside the event handler, use the `$rateLimitApprovalId` replace variable with the undo effect

### Example

This example shows an immediate undo (not practical, but demonstrates the mechanics):

```text
Check Effect:
- Bucket: my-bucket
- Tokens: 10
- [X] Trigger the 'Rate Limit Approved' event if approved

Event Handler (Rate Limit Approved):
Effect List:
1. Rate Limiter: Undo Check
   - Approval ID: $rateLimitApprovalId
```

## Practical Examples

### Undo Command

Create a chat command `!undo` that reverses the last rate limit check:

```text
Command: !undo

Check Effect:
- Bucket: chat-commands
- Tokens: 5
- [X] Trigger the 'Rate Limit Approved' event if approved

Event Handler (Rate Limit Approved):
1. Set Custom Variable
   - Variable: lastChatApprovalId
   - Value: $rateLimitApprovalId
   - Mode: Global

Undo Command (!undo):
1. Rate Limiter: Undo Check
   - Approval ID: $lastChatApprovalId
2. Chat Message
   - Message: "Undid your last command. Tokens restored."
```

### Conditional Undo

Undo a check if a specific condition is not met:

```text
Effect List:
1. Rate Limiter: Check Request
   - Bucket: reward-redemption
   - Tokens: 100

2. Set Custom Variable
   - Variable: randomNumber
   - Value: $randomNumber[1, 10]
   - Mode: Effect List

3. Conditional Effects
   - Condition: $randomNumber greater than 5
   - Effects:
     - Rate Limiter: Undo Check
       - Approval ID: $effectOutput[rateLimitApprovalId]
     - Chat Message
       - Message: "Random check failed. Tokens refunded."
```

## Important Notes

- Approval IDs expire after 10 minutes
- Each approval ID can only be used once to undo a check
- Inquiry checks (non-consuming checks) generate approval IDs, but undoing them has no effect since they consumed no tokens
- Token restoration respects the bucket maximum (tokens cannot exceed the bucket size)
