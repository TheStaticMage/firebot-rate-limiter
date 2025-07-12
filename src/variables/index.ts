import { firebot } from '../main';
import { rateLimitErrorMessage } from './error-message';
import { rateLimitInvocation } from './invocation';
import { rateLimitInvocationLimit } from './invocation-limit';
import { rateLimitMessageId } from './message-id';
import { rateLimitMetadataKey } from './metadata-key';
import { rateLimitNext } from './next';
import { rateLimitOriginalUsername } from './original-username';
import { rateLimitRawObject } from './raw-object';
import { rateLimitRejectReason } from './reason';
import { rateLimitRemaining } from './remaining';

export function registerReplaceVariables() {
    const { replaceVariableManager } = firebot.modules;

    replaceVariableManager.registerReplaceVariable(rateLimitErrorMessage);
    replaceVariableManager.registerReplaceVariable(rateLimitInvocation);
    replaceVariableManager.registerReplaceVariable(rateLimitInvocationLimit);
    replaceVariableManager.registerReplaceVariable(rateLimitMessageId);
    replaceVariableManager.registerReplaceVariable(rateLimitMetadataKey);
    replaceVariableManager.registerReplaceVariable(rateLimitNext);
    replaceVariableManager.registerReplaceVariable(rateLimitOriginalUsername);
    replaceVariableManager.registerReplaceVariable(rateLimitRawObject);
    replaceVariableManager.registerReplaceVariable(rateLimitRejectReason);
    replaceVariableManager.registerReplaceVariable(rateLimitRemaining);
}
