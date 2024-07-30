import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as logsDestinations from 'aws-cdk-lib/aws-logs-destinations';
import * as constructs from 'constructs';
import * as path from 'path';

export interface LogNotifierAttributes {
  readonly destinationFunctionArn: string;
  readonly filterPattern: logs.IFilterPattern;
}

export interface ILogNotifier {
  readonly destinationFunctionArn: string;
  readonly filterPattern: logs.IFilterPattern;
  watch(logGroup: logs.ILogGroup): void;
};

abstract class LogNotifierImpl extends cdk.Resource implements ILogNotifier {
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
  watch(logGroup: logs.ILogGroup) {
    new logs.SubscriptionFilter(this, `${logGroup.node.id}SubscriptionFilter`, {
      destination: new logsDestinations.LambdaDestination(this.handleLogFunc),
      filterPattern: this.filterPattern,
      logGroup,
    });
  }
}

export interface DateTimeFormatOptions {
  readonly localeMatcher?: "best fit" | "lookup" | undefined;
  readonly weekday?: "long" | "short" | "narrow" | undefined;
  readonly era?: "long" | "short" | "narrow" | undefined;
  readonly year?: "numeric" | "2-digit" | undefined;
  readonly month?: "numeric" | "2-digit" | "long" | "short" | "narrow" | undefined;
  readonly day?: "numeric" | "2-digit" | undefined;
  readonly hour?: "numeric" | "2-digit" | undefined;
  readonly minute?: "numeric" | "2-digit" | undefined;
  readonly second?: "numeric" | "2-digit" | undefined;
  readonly timeZoneName?: "short" | "long" | "shortOffset" | "longOffset" | "shortGeneric" | "longGeneric" | undefined;
  readonly formatMatcher?: "best fit" | "basic" | undefined;
  readonly hour12?: boolean | undefined;
  readonly timeZone?: string | undefined;
  readonly locales?: string | string[];
};

export interface LogNotifierProps {
  readonly dateTimeFormatOptions?: DateTimeFormatOptions;
  readonly filterPattern: logs.IFilterPattern;
  readonly slackIncomingWebhookUrl: string;
}

export class LogNotifier extends LogNotifierImpl {
  readonly filterPattern: logs.IFilterPattern;
  protected handleLogFunc: lambda.IFunction;
  constructor(
    scope: constructs.Construct,
    id: string,
    props: LogNotifierProps,
  ) {
    super(scope, id, { physicalName: id });

    const dateTimeFormatOptions = props.dateTimeFormatOptions ?? {
      locales: 'en-US',
      timeZone: 'UTC',
      timeZoneName: 'short',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    };
    const dateTimeFormat = new Intl.DateTimeFormat(dateTimeFormatOptions.locales, dateTimeFormatOptions);

    this.filterPattern = props.filterPattern;
    this.handleLogFunc = new lambda.Function(this, 'LogHandler', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-log-handler')),
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      environment: {
        'RESOLVED_DATETIME_FORMAT_OPTIONS': JSON.stringify(dateTimeFormat.resolvedOptions()),
        'SLACK_INCOMING_WEBHOOK_URL': props.slackIncomingWebhookUrl,
      },
    });
  }
  static fromAttributes(scope: constructs.Construct, id: string, attrs: LogNotifierAttributes): ILogNotifier {
    class LogNotifierFromAttributes extends LogNotifierImpl {
      filterPattern = attrs.filterPattern;
      protected handleLogFunc;
      constructor() {
        super(scope, id, { physicalName: id });
        this.handleLogFunc = lambda.Function.fromFunctionAttributes(this, 'DestinationFunc', {
          functionArn: attrs.destinationFunctionArn,
          sameEnvironment: true,
        });
      }
    }
    return new LogNotifierFromAttributes();
  }
}
