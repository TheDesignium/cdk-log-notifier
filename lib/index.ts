import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as logsDestinations from 'aws-cdk-lib/aws-logs-destinations';
import * as constructs from 'constructs';
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
    new logs.SubscriptionFilter(this, `${logGroup.node.id}SubscriptionFilter`, {
      destination: new logsDestinations.LambdaDestination(this.handleLogFunc),
      filterPattern: this.filterPattern,
      logGroup,
    });
  }
}

export interface LogNotifierProps {
  dateTimeFormat?: Intl.DateTimeFormat;
  filterPattern: logs.IFilterPattern;
  slackIncomingWebhookUrl: string;
}

class LogNotifierFacade extends LogNotifierImpl {
  filterPattern: logs.IFilterPattern;
  protected handleLogFunc: lambda.IFunction;
  constructor(
    scope: constructs.Construct,
    id: string,
    props: LogNotifierProps,
  ) {
    super(scope, id, { physicalName: id });

    const dateTimeFormat = props.dateTimeFormat ?? new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      timeZoneName: 'short',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });

    this.filterPattern = props.filterPattern;
    this.handleLogFunc = new lambda.Function(this, 'LogHandler', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-log-handler')),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment: {
        'RESOLVED_DATETIME_FORMAT_OPTIONS': JSON.stringify(dateTimeFormat.resolvedOptions()),
        'SLACK_INCOMING_WEBHOOK_URL': props.slackIncomingWebhookUrl,
      },
    });
  }
  static fromAttributes(scope: constructs.Construct, id: string, attrs: LogNotifierAttributes): LogNotifier {
    class LogNotifierFromAttributes extends LogNotifierImpl {
      filterPattern = attrs.filterPattern;
      protected handleLogFunc = lambda.Function.fromFunctionArn(scope, `${id}DestinationFunc`, attrs.destinationFunctionArn);
    }
    return new LogNotifierFromAttributes(scope, id, { physicalName: id });
  }
}

export const LogNotifier = LogNotifierFacade;
