import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import * as logsDestinations from '@aws-cdk/aws-logs-destinations';
import * as path from 'path';

export interface LogNotifierAttributes {
  destinationFunctionArn: string;
  filterPattern: logs.IFilterPattern;
}

export interface LogNotifier extends LogNotifierAttributes {
  watch(logGroup: logs.ILogGroup): void;
};

abstract class LogNotifierImpl extends cdk.Resource implements LogNotifier {
  abstract readonly filterPattern: logs.IFilterPattern;
  protected abstract readonly handleLogFunc: lambda.IFunction;
  get destinationFunctionArn(): string {
    return this.handleLogFunc.functionArn;
  }
  get attributes(): LogNotifierAttributes {
    return {
      destinationFunctionArn: this.destinationFunctionArn,
      filterPattern: this.filterPattern,
    };
  }
  watch(logGroup: logs.LogGroup) {
    new logs.SubscriptionFilter(this, `${logGroup.node.uniqueId}SubscriptionFilter`, {
      destination: new logsDestinations.LambdaDestination(this.handleLogFunc),
      filterPattern: this.filterPattern,
      logGroup,
    });
  }
}

export interface LogNotifierProps {
  filterPattern: logs.IFilterPattern;
  slackIncomingWebhookUrl: string;
}

class LogNotifierFacade extends LogNotifierImpl {
  filterPattern: logs.IFilterPattern;
  protected handleLogFunc: lambda.IFunction;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: LogNotifierProps,
  ) {
    super(scope, id, { physicalName: id });

    this.filterPattern = props.filterPattern;
    this.handleLogFunc = new lambda.Function(this, 'LogHandler', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-log-handler')),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment: {
        'SLACK_INCOMING_WEBHOOK_URL': props.slackIncomingWebhookUrl,
      },
    });

    // See aws/aws-cdk #7588, #8726.
    new lambda.CfnPermission(this, 'AnyLogsCanInvoke', {
      action: 'lambda:InvokeFunction',
      functionName: this.handleLogFunc.functionArn,
      principal: 'logs.amazonaws.com',
    });
  }
  static fromAttributes(scope: cdk.Construct, id: string, attrs: LogNotifierAttributes): LogNotifier {
    class LogNotifierFromAttributes extends LogNotifierImpl {
      filterPattern = attrs.filterPattern;
      protected handleLogFunc = lambda.Function.fromFunctionArn(scope, `${id}DestinationFunc`, attrs.destinationFunctionArn);
    }
    return new LogNotifierFromAttributes(scope, id, { physicalName: id });
  }
}

export const LogNotifier = LogNotifierFacade;
