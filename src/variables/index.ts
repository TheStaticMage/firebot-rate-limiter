import { firebot } from '../main';
import { rateLimitErrorMessage } from './error-message';
import { rateLimitInvocation } from './invocation';
import { rateLimitInvocationLimit } from './invocation-limit';
import { rateLimitMessageId } from './message-id';
import { rateLimitMetadataKey } from './metadata-key';
import { rateLimitNext } from './next';
import { rateLimitRawObject } from './raw-object';
import { rateLimitRejectReason } from './reason';
import { rateLimitRemaining } from './remaining';
import { rateLimitTriggerMetadata } from './trigger-metadata';
import { rateLimitTriggerType } from './trigger-type';
import { rateLimitTriggerUsername } from './trigger-username';

export function registerReplaceVariables() {
    const { replaceVariableManager } = firebot.modules;

    replaceVariableManager.registerReplaceVariable(rateLimitErrorMessage);
    replaceVariableManager.registerReplaceVariable(rateLimitInvocation);
    replaceVariableManager.registerReplaceVariable(rateLimitInvocationLimit);
    replaceVariableManager.registerReplaceVariable(rateLimitMessageId);
    replaceVariableManager.registerReplaceVariable(rateLimitMetadataKey);
    replaceVariableManager.registerReplaceVariable(rateLimitNext);
    replaceVariableManager.registerReplaceVariable(rateLimitTriggerMetadata);
    replaceVariableManager.registerReplaceVariable(rateLimitTriggerType);
    replaceVariableManager.registerReplaceVariable(rateLimitTriggerUsername);
    replaceVariableManager.registerReplaceVariable(rateLimitRawObject);
    replaceVariableManager.registerReplaceVariable(rateLimitRejectReason);
    replaceVariableManager.registerReplaceVariable(rateLimitRemaining);
}
