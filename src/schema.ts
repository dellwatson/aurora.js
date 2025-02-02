/* This is free and unencumbered software released into the public domain. */

import { Err, Ok, Result } from '@hqoss/monads';
import BN from 'bn.js';
import { utils } from 'near-api-js';
import { bytesToHex } from './utils.js';

abstract class Assignable {
  encode(): Uint8Array {
    return utils.serialize.serialize(SCHEMA, this);
  }
}

// Borsh-encoded parameters for the `begin_block` method.
export class BeginBlockArgs extends Assignable {
  constructor(
    public readonly hash: Uint8Array,
    public readonly coinbase: Uint8Array,
    public readonly timestamp: Uint8Array,
    public readonly number: Uint8Array,
    public readonly difficulty: Uint8Array,
    public readonly gaslimit: Uint8Array
  ) {
    super();
  }
}

// Borsh-encoded parameters for the `begin_chain` method.
export class BeginChainArgs extends Assignable {
  constructor(public chainID: Uint8Array) {
    super();
  }
}

export class SubmitResult {
  public readonly result:
    | SubmitResultV2
    | SubmitResultV1
    | LegacyExecutionResult;

  constructor(result: SubmitResultV2 | SubmitResultV1 | LegacyExecutionResult) {
    this.result = result;
  }

  output(): Result<Uint8Array, ExecutionError> {
    switch (this.result.kind) {
      case 'SubmitResultV2':
        if (this.result.status.success) {
          return Ok(Buffer.from(this.result.status.success.output));
        } else if (this.result.status.revert) {
          return Err(this.result.status.revert);
        } else if (this.result.status.outOfFund) {
          return Err(this.result.status.outOfFund);
        } else if (this.result.status.outOfGas) {
          return Err(this.result.status.outOfGas);
        } else if (this.result.status.outOfOffset) {
          return Err(this.result.status.outOfOffset);
        } else if (this.result.status.callTooDeep) {
          return Err(this.result.status.callTooDeep);
        } else {
          // Should be unreachable since one enum variant should be assigned
          return Err('LegacyStatusFalse');
        }
      case 'SubmitResultV1':
        if (this.result.status.success) {
          return Ok(Buffer.from(this.result.status.success.output));
        } else if (this.result.status.revert) {
          return Err(this.result.status.revert);
        } else if (this.result.status.outOfFund) {
          return Err(this.result.status.outOfFund);
        } else if (this.result.status.outOfGas) {
          return Err(this.result.status.outOfGas);
        } else if (this.result.status.outOfOffset) {
          return Err(this.result.status.outOfOffset);
        } else if (this.result.status.callTooDeep) {
          return Err(this.result.status.callTooDeep);
        } else {
          // Should be unreachable since one enum variant should be assigned
          return Err('LegacyStatusFalse');
        }
      case 'LegacyExecutionResult':
        if (this.result.status) {
          return Ok(this.result.output);
        } else {
          return Err('LegacyStatusFalse');
        }
    }
  }

  static decode(input: Buffer): SubmitResult {
    // Note: SubmitResultV1 and LegacyExecutionResult binary formats
    // will never start with the version byte of SubmitResultV2
    // because SubmitResultV1 starts with an enum with fewer than 7
    // variants and LegacyExecutionResult starts with a boolean.
    if (input[0] == SubmitResultV2.VERSION) {
      const v2 = SubmitResultV2.decode(input);
      return new SubmitResult(v2);
    }
    try {
      const v1 = SubmitResultV1.decode(input);
      return new SubmitResult(v1);
    } catch (error) {
      const legacy = LegacyExecutionResult.decode(input);
      return new SubmitResult(legacy);
    }
  }
}

export type LegacyStatusFalse = 'LegacyStatusFalse';
export type ExecutionError =
  | RevertStatus
  | OutOfGas
  | OutOfFund
  | OutOfOffset
  | CallTooDeep
  | LegacyStatusFalse;

export class SuccessStatus extends utils.enums.Assignable {
  public readonly output: Uint8Array | number[];

  constructor(args: { output: Uint8Array | number[] }) {
    super(args);
    this.output = Buffer.from(args.output);
  }
}

export class RevertStatus extends utils.enums.Assignable {
  public readonly output: Uint8Array | number[];

  constructor(args: { output: Uint8Array | number[] }) {
    super(args);
    this.output = Buffer.from(args.output);
  }
}

export class OutOfGas extends utils.enums.Assignable {}
export class OutOfFund extends utils.enums.Assignable {}
export class OutOfOffset extends utils.enums.Assignable {}
export class CallTooDeep extends utils.enums.Assignable {}

export class TransactionStatus extends utils.enums.Enum {
  public readonly success?: SuccessStatus;
  public readonly revert?: RevertStatus;
  public readonly outOfGas?: OutOfGas;
  public readonly outOfFund?: OutOfFund;
  public readonly outOfOffset?: OutOfOffset;
  public readonly callTooDeep?: CallTooDeep;

  static decode(input: Buffer): TransactionStatus {
    return utils.serialize.deserialize(SCHEMA, TransactionStatus, input);
  }
}

// Latest Borsh-encoded result from the `submit` method.
export class SubmitResultV2 extends Assignable {
  // discriminator to match on type in `SubmitResult`
  kind: 'SubmitResultV2' = 'SubmitResultV2';
  public static VERSION: 7 = 7;
  public readonly version: 7;
  public readonly status: TransactionStatus;
  public readonly gasUsed: number | bigint;
  public readonly logs: LogEventWithAddress[];

  constructor(args: {
    status: TransactionStatus;
    gasUsed: number | bigint | BN;
    logs: LogEventWithAddress[];
  }) {
    super();
    this.version = 7;
    this.status = args.status;
    this.gasUsed = BigInt(args.gasUsed.toString());
    this.logs = args.logs;
  }

  static decode(input: Buffer): SubmitResultV2 {
    return utils.serialize.deserialize(SCHEMA, SubmitResultV2, input);
  }
}

// Previous Borsh-encoded result from the `submit` method.
export class SubmitResultV1 extends Assignable {
  // discriminator to match on type in `SubmitResult`
  kind: 'SubmitResultV1' = 'SubmitResultV1';
  public readonly status: TransactionStatus;
  public readonly gasUsed: number | bigint;
  public readonly logs: LogEvent[];

  constructor(args: {
    status: TransactionStatus;
    gasUsed: number | bigint | BN;
    logs: LogEvent[];
  }) {
    super();
    this.status = args.status;
    this.gasUsed = BigInt(args.gasUsed.toString());
    this.logs = args.logs;
  }

  static decode(input: Buffer): SubmitResultV1 {
    return utils.serialize.deserialize(SCHEMA, SubmitResultV1, input);
  }
}

// Old Borsh-encoded result from the `submit` method.
export class LegacyExecutionResult extends Assignable {
  // discriminator to match on type in `SubmitResult`
  kind: 'LegacyExecutionResult' = 'LegacyExecutionResult';
  public readonly status: boolean;
  public readonly gasUsed: number | bigint;
  public readonly output: Uint8Array;
  public readonly logs: LogEvent[];

  constructor(args: {
    status: boolean | number;
    gasUsed: number | bigint | BN;
    output: Uint8Array | number[];
    logs: LogEvent[];
  }) {
    super();
    this.status = Boolean(args.status);
    this.gasUsed = BigInt(args.gasUsed.toString());
    this.output = Buffer.from(args.output);
    this.logs = args.logs;
  }

  static decode(input: Buffer): LegacyExecutionResult {
    return utils.serialize.deserialize(SCHEMA, LegacyExecutionResult, input);
  }
}

// Borsh-encoded parameters for the `call` method.
export class FunctionCallArgs extends Assignable {
  constructor(public contract: Uint8Array, public input: Uint8Array) {
    super();
  }
}

// Borsh-encoded parameters for the `get_chain_id` method.
export class GetChainID extends Assignable {
  constructor() {
    super();
  }
}

// Borsh-encoded parameters for the `get_storage_at` method.
export class GetStorageAtArgs extends Assignable {
  constructor(public address: Uint8Array, public key: Uint8Array) {
    super();
  }
}

// Borsh-encoded log for use in a latest `SubmitResult`.
export class LogEventWithAddress extends Assignable {
  public readonly address: Uint8Array;
  public readonly topics: RawU256[];
  public readonly data: Uint8Array;

  constructor(args: {
    address: Uint8Array | number[];
    topics: RawU256[];
    data: Uint8Array | number[];
  }) {
    super();
    this.address = Buffer.from(args.address);
    this.topics = args.topics;
    this.data = Buffer.from(args.data);
  }
}

// Borsh-encoded log for use in a `ExecutionResult`.
export class LogEvent extends Assignable {
  public readonly topics: RawU256[];
  public readonly data: Uint8Array;

  constructor(args: { topics: RawU256[]; data: Uint8Array | number[] }) {
    super();
    this.topics = args.topics;
    this.data = Buffer.from(args.data);
  }
}

// Borsh-encoded parameters for the `meta_call` method.
export class MetaCallArgs extends Assignable {
  constructor(
    public readonly signature: Uint8Array,
    public readonly v: number,
    public readonly nonce: Uint8Array,
    public readonly feeAmount: Uint8Array,
    public readonly feeAddress: Uint8Array,
    public readonly contractAddress: Uint8Array,
    public readonly value: Uint8Array,
    public readonly methodDef: string,
    public readonly args: Uint8Array
  ) {
    super();
  }
}

// Borsh-encoded parameters for the `new` method.
export class NewCallArgs extends Assignable {
  constructor(
    public readonly chainID: Uint8Array,
    public readonly ownerID: string,
    public readonly bridgeProverID: string,
    public readonly upgradeDelayBlocks: number | BN
  ) {
    super();
  }
}

// Metadata for NEP-141 Fungible tokens (ETH on NEAR is implemented as NEP-141)
export class FungibleTokenMetadata extends Assignable {
  constructor(
    public readonly spec: string,
    public readonly name: string,
    public readonly symbol: string,
    public readonly icon: string | null,
    public readonly reference: string | null,
    public readonly reference_hash: Uint8Array | null,
    public readonly decimals: number
  ) {
    super();
  }

  static default(): FungibleTokenMetadata {
    return new FungibleTokenMetadata(
      'ft-1.0.0',
      'Ether',
      'ETH',
      'data:image/png;base64,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',
      null,
      null,
      18
    );
  }
}

// Borsh-encoded parameters for the `new_eth_connector` method.
export class InitCallArgs extends Assignable {
  constructor(
    public readonly prover_account: string,
    public readonly eth_custodian_address: string,
    public readonly metadata: FungibleTokenMetadata
  ) {
    super();
  }
}

// Borsh-encoded U256 integer.
export class RawU256 extends Assignable {
  public readonly value: Uint8Array;

  constructor(args?: Uint8Array | { value: Uint8Array | number[] }) {
    super();
    if (!args) {
      this.value = Buffer.alloc(32);
    } else {
      const bytes = Buffer.from(args instanceof Uint8Array ? args : args.value);
      //assert(bytes.length == 32); // TODO
      this.value = bytes;
    }
  }

  toBytes(): Uint8Array {
    return this.value;
  }

  toString(): string {
    return bytesToHex(this.value);
  }
}

// Borsh-encoded parameters for the `view` method.
export class ViewCallArgs extends Assignable {
  constructor(
    public readonly sender: Uint8Array,
    public readonly address: Uint8Array,
    public readonly amount: Uint8Array,
    public readonly input: Uint8Array
  ) {
    super();
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
const SCHEMA = new Map<Function, any>([
  [
    BeginBlockArgs,
    {
      kind: 'struct',
      fields: [
        ['hash', [32]],
        ['coinbase', [32]],
        ['timestamp', [32]],
        ['number', [32]],
        ['difficulty', [32]],
        ['gaslimit', [32]],
      ],
    },
  ],
  [BeginChainArgs, { kind: 'struct', fields: [['chainID', [32]]] }],
  [
    TransactionStatus,
    {
      kind: 'enum',
      field: 'enum',
      values: [
        ['success', SuccessStatus],
        ['revert', RevertStatus],
        ['outOfGas', OutOfGas],
        ['outOfFund', OutOfFund],
        ['outOfOffset', OutOfOffset],
        ['callTooDeep', CallTooDeep],
      ],
    },
  ],
  [
    SuccessStatus,
    {
      kind: 'struct',
      fields: [['output', ['u8']]],
    },
  ],
  [
    RevertStatus,
    {
      kind: 'struct',
      fields: [['output', ['u8']]],
    },
  ],
  [
    OutOfGas,
    {
      kind: 'struct',
      fields: [],
    },
  ],
  [
    OutOfFund,
    {
      kind: 'struct',
      fields: [],
    },
  ],
  [
    OutOfOffset,
    {
      kind: 'struct',
      fields: [],
    },
  ],
  [
    CallTooDeep,
    {
      kind: 'struct',
      fields: [],
    },
  ],
  [
    SubmitResultV2,
    {
      kind: 'struct',
      fields: [
        ['version', 'u8'],
        ['status', TransactionStatus],
        ['gasUsed', 'u64'],
        ['logs', [LogEventWithAddress]],
      ],
    },
  ],
  [
    SubmitResultV1,
    {
      kind: 'struct',
      fields: [
        ['status', TransactionStatus],
        ['gasUsed', 'u64'],
        ['logs', [LogEvent]],
      ],
    },
  ],
  [
    LegacyExecutionResult,
    {
      kind: 'struct',
      fields: [
        ['status', 'u8'],
        ['gasUsed', 'u64'],
        ['output', ['u8']],
        ['logs', [LogEvent]],
      ],
    },
  ],
  [
    FunctionCallArgs,
    {
      kind: 'struct',
      fields: [
        ['contract', [20]],
        ['input', ['u8']],
      ],
    },
  ],
  [GetChainID, { kind: 'struct', fields: [] }],
  [
    GetStorageAtArgs,
    {
      kind: 'struct',
      fields: [
        ['address', [20]],
        ['key', [32]],
      ],
    },
  ],
  [
    LogEventWithAddress,
    {
      kind: 'struct',
      fields: [
        ['address', [20]],
        ['topics', [RawU256]],
        ['data', ['u8']],
      ],
    },
  ],
  [
    LogEvent,
    {
      kind: 'struct',
      fields: [
        ['topics', [RawU256]],
        ['data', ['u8']],
      ],
    },
  ],
  [
    MetaCallArgs,
    {
      kind: 'struct',
      fields: [
        ['signature', [64]],
        ['v', 'u8'],
        ['nonce', [32]],
        ['feeAmount', [32]],
        ['feeAddress', [20]],
        ['contractAddress', [20]],
        ['value', [32]],
        ['methodDef', 'string'],
        ['args', ['u8']],
      ],
    },
  ],
  [
    NewCallArgs,
    {
      kind: 'struct',
      fields: [
        ['chainID', [32]],
        ['ownerID', 'string'],
        ['bridgeProverID', 'string'],
        ['upgradeDelayBlocks', 'u64'],
      ],
    },
  ],
  [
    FungibleTokenMetadata,
    {
      kind: 'struct',
      fields: [
        ['spec', 'string'],
        ['name', 'string'],
        ['symbol', 'string'],
        ['icon', { kind: 'option', type: 'string' }],
        ['reference', { kind: 'option', type: 'string' }],
        ['reference_hash', { kind: 'option', type: [32] }],
        ['decimals', 'u8'],
      ],
    },
  ],
  [
    InitCallArgs,
    {
      kind: 'struct',
      fields: [
        ['prover_account', 'string'],
        ['eth_custodian_address', 'string'],
        ['metadata', FungibleTokenMetadata],
      ],
    },
  ],
  [
    ViewCallArgs,
    {
      kind: 'struct',
      fields: [
        ['sender', [20]],
        ['address', [20]],
        ['amount', [32]],
        ['input', ['u8']],
      ],
    },
  ],
  [RawU256, { kind: 'struct', fields: [['value', [32]]] }],
]);
