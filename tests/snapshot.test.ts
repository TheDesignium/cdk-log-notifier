import 'jest-cdk-snapshot';
import { expect, test } from 'vitest';
import { LogNotifier } from '../lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Stack } from 'aws-cdk-lib/core';

test('snapshot test', () => {
  const stack = new Stack();
  const lambda1 = new lambda.Function(stack, 'lambda', {
    runtime: lambda.Runtime.NODEJS_18_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = async function() { return "Hello, world!"; }'),
  });
  const logNotifier = new LogNotifier(stack, 'logNotifier', {
    filterPattern: logs.FilterPattern.allTerms('ERROR'),
    slackIncomingWebhookUrl: 'https://hooks.slack.com/test',
  });

  logNotifier.watch(lambda1.logGroup);

  expect(stack).toMatchCdkSnapshot({
    ignoreAssets: true,
  });
});
