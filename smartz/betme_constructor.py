from smartz.api.constructor_engine import ConstructorInstance


class Constructor(ConstructorInstance):

    def get_version(self):
        return {
            "result": "success",
            "version": 1
        }

    def get_params(self):
        json_schema = {
            "type": "object",
            "required": [
                "assertion"
            ],
            "additionalProperties": True,

            "properties": {
                "assertion": {
                    "title": "Assertion text",
                    "description": "You as owner of contract will bet this assertion is true, while your opponent will bet it is false.",
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 400,
                    "pattern": "^.+$"
                },
                "deadline": {
                    "title": "Deadline",
                    "description": "Dispute should be resolved before this point in time, otherwise no one considered a winner. Choose date in the future, otherwise deploy will fail",
                    "$ref": "#/definitions/unixTime",
                },
                "arbiterAddr": {
                    "title": "Arbiter ethereum address",
                    "description": "Arbiter decides is the assertion true or false. Leave this field blank to choose arbiter later",
                    "$ref": "#/definitions/address"
                },
                "feePercent": {
                    "title": "Arbiter fee percent",
                    "description": "Arbiter fee as % of bet amount [0-100). If you bet for 1 ether and feePercent is 10, then arbiter will receive 0.1 ether, and the winner will receive 0.9 ether",
                    "type": "number",
                    "minimum": 0,
                    "maximum": 99999999999999999999,
                },
                "opponentAddr": {
                    "title": "Opponent ethereum address",
                    "description": "You may leave this field blank to let anyone bet against your assertion or set opponent address later",
                    "$ref": "#/definitions/address"
                },
                "arbiterPenaltyAmount": {
                    "title": "Arbiter penalty amount",
                    "description": "Ether value to be sent by arbiter as a garantee and returned to him after he made his decision",
                    "type": "number",
                },
            }
        }

        ui_schema = {
            "deadline": {
                "ui:widget": "unixTime",
            },
            "feePercent": {
                "ui:widget": "ethCount",
            },
            "arbiterPenaltyAmount": {
                "ui:widget": "ethCount",
            },
        }

        return {
            "result": "success",
            "schema": json_schema,
            "ui_schema": ui_schema
        }

    def construct(self, fields):
        zeroAddr = 'address(0)'
        defaultDeadline = 'now + 86400*7'
        deadline = fields.get('deadline', defaultDeadline) or defaultDeadline
        arbiterAddr = fields.get('arbiterAddr', zeroAddr) or zeroAddr
        opponentAddr = fields.get('opponentAddr', zeroAddr) or zeroAddr
        feePercent = fields.get('feePercent', 0) or 0;
        arbiterPenaltyAmount = fields.get('arbiterPenaltyAmount', 0) or 0;

        source = self.__class__._TEMPLATE \
            .replace('%assertion%', fields['assertion']) \
            .replace('%deadline%', str(deadline)) \
            .replace('%feePercent%', str(feePercent)) \
            .replace('%arbiterAddr%', arbiterAddr) \
            .replace('%opponentAddr%', opponentAddr) \
            .replace('%arbiterPenaltyAmount%', str(arbiterPenaltyAmount)) \

        return {
            "result": "success",
            'source': source,
            'contract_name': "BetMeWrapper"
        }

    def post_construct(self, fields, abi_array):

        function_titles = {
             # View functions
            'Assertion': {
                'title': 'Assertion text',
                'description': 'some statement considered to be true by contract owner',
                 'sorting_order': 1,
            },
            'currentBet': {
                'title': 'Current bet amount',
                'description': 'Ether amount sent by contract owner to bet on assertion text is true',
                "ui:widget": "ethCount",
                'sorting_order': 2,
            },
            'Deadline': {
                'title': 'Deadline',
                'description': 'Current value of Deadline',
                "ui:widget": "unixTime",
                'sorting_order': 3,
            },
            'ArbiterFee': {
                'title': 'Arbiter fee percent',
                'description': 'Current value for arbiter fee as percent of bet amount',
                "ui:widget": "ethCount",
                'sorting_order': 4,
            },
            'ArbiterPenaltyAmount': {
                'title': 'Arbiter penalty amount',
                'description': 'Ether amount arbiter must send as a garantee of his intention to judge this dispute',
                "ui:widget": "ethCount",
                'sorting_order': 5,
            },
            'ArbiterAddress': {
                "title": "Arbiter ethereum address",
                "description": "Arbiter decides is the assertion true or false",
                'sorting_order': 6,
            },
            'OpponentAddress': {
                "title": "Opponent ethereum address",
                "description": "If this address set to 0x0000000000000000000000000000000000000000, anyone may bet on assertion is false",
                'sorting_order': 7,
            },
            'StateVersion': {
                "title": "Current state version number",
                "description": "Current state version number must be passed as a parameter to agreeToBecameArbiter and betAssertIsFalse functions",
                'sorting_order': 8,
            },
            'IsArbiterAddressConfirmed': {
                "title": "Arbiter agreed to judge this dispute",
                "description": "Arbiter has confirmed he is argee to judge this dispute with specific assertion text, deadline, bet, fee and penalty amount",
                'sorting_order': 20,
            },
            'IsOpponentBetConfirmed': {
                "title": "Is opponent confirmed his bet",
                "description": "There is opponent found for this dispute and hi made his bet by transfering ether to smartcontract",
                'sorting_order': 21,
            },
            'IsDecisionMade': {
                "title": "Arbiter considered assertion true or false",
                "description": "Arbiter is agreed to judge this dispute and considered statement exactly true or false",
                'sorting_order': 22,
            },
            'ownerPayout': {
                'title': 'Owner payout',
                'description': 'helper func',
                "ui:widget": "ethCount",
                'sorting_order': 100,
            },
            'opponentPayout': {
                'title': 'Opponent payout',
                'description': 'helper func',
                "ui:widget": "ethCount",
                'sorting_order': 101,
            },
            'arbiterPayout': {
                'title': 'Arbiter payout',
                'description': 'helper func',
                "ui:widget": "ethCount",
                'sorting_order': 102,
            },
            'ArbiterFeeAmountInEther': {
                'title': 'Arbiter fee in ether',
                'description': 'Considering bet amount and arbiter fee percent, how much ether arbiter will be able to withdraw',
                "ui:widget": "ethCount",
                'sorting_order': 103,
            },
            'getTime': {
                'title': 'now',
                'description': 'current timestamp',
                "ui:widget": "unixTime",
                'sorting_order': 300,
            },
            # Write functions
            'setAssertionText': {
                'title': 'Change assertion text',
                'description': 'some statement considered to be true by contract owner',
                'inputs': [
                    {'title': 'Assertion', 'description': 'write some true statement in text form'},
                ],
                'sorting_order': 100,
            },
            'setDeadline': {
                'title': 'Change deadline',
                'description': 'choose new date of dispute forced interruption',
                'inputs': [
                    {
                        'title': 'new deadline',
                        'description': 'arbiter should be able to make decision before new deadline',
                        'ui:widget': 'unixTime'
                    },
                ],
                'sorting_order': 101,
            },
            'setArbiterFee': {
                'title': 'Change arbiter fee percent',
                'description': 'set new value of arbiter fee as percent of future bet amount',
                'inputs': [
                    {
                        'title': 'new fee percent [0,100.0)',
                        'description': 'change arbiter fee value before arbiter agreed to judge the dispute',
                        'ui:widget': 'ethCount'
                    },
                ],
                'sorting_order': 102,
            },
            'setArbiterPenaltyAmount': {
                'title': 'Change arbiter penalty amount',
                'description': 'ether value to be sent by arbiter as a garantee and returned to him after he made his decision',
                'inputs': [
                    {
                        'title': 'ether amount',
                        'description': 'arbiter penalty amount',
                        'ui:widget': 'ethCount'
                    },
                ],
                'sorting_order': 103,
            },
            'setArbiterAddress': {
                'title': 'Change arbiter address',
                'description': 'Arbiter address must be set before arbiter agreed to judge the dispute',
                'inputs': [
                    {
                        'title': 'Arbiter ethereum address',
                        'description': 'Arbiter ethereum address',
                    },
                ],
                'sorting_order': 104,
            },
            'setOpponentAddress': {
                'title': 'Change opponnet address',
                'description': 'Opponent address may be set to limit dispute participants to one person',
                'inputs': [
                    {
                        'title': 'Opponent ethereum address',
                        'description': 'set this to 0x0000000000000000000000000000000000000000 to let anyone be an opponnet',
                    },
                ],
                'sorting_order': 105,
            },
            'bet': {
                'title': 'Owner Bet',
                'description': 'Make owner bet',
                'payable_details': {
                    'title': 'Bet amount',
                    'description': 'Ether amount to bet for asertion text is a true statement',
                },
                'sorting_order': 106,
            },
            'agreeToBecameArbiter': {
                'title': 'Agree to be an arbiter',
                'description': 'Agree to became an arbiter for this dispute and send penalty amount (if it is not zero)',
                'payable_details': {
                    'title': 'arbiter penalty amount',
                    'description': 'Ether amount equal to what is returned by ArbiterPenaltyAmount function',
                },
                'inputs': [
                    {
                        'title': 'version state number',
                        'description': 'Place current value of "Current state version number" here',
                    },
                ],
                'sorting_order': 107,
            },
            'arbiterSelfRetreat': {
                'title': 'Arbiter self retreat',
                'description': 'Arbiter may retreat if no opponnet bet has been made',
                'sorting_order': 108,
            },
            'betAssertIsFalse': {
                'title': 'Opponent Bet',
                'description': 'Make opponent bet for assertion text contains false statement',
                'payable_details': {
                    'title': 'Bet amount',
                    'description': 'Ether amount must be equal to owner bet as returned by "Current bet amount" (currentBet function)',
                },
                'inputs': [
                    {
                        'title': 'version state number',
                        'description': 'Place current value of "Current state version number" here',
                    },
                ],
                'sorting_order': 109,
            },
            'agreeAssertionTrue': {
                'title': 'Arbiter: assertion is True',
                'description': 'Arbiter confirm assertion text contains true statement',
                'sorting_order': 110,
            },
            'agreeAssertionFalse': {
                'title': 'Arbiter: assertion is False',
                'description': 'Arbiter confirm assertion text contains false statement',
                'sorting_order': 111,
            },
            'agreeAssertionUnresolvable': {
                'title': 'Arbiter: assertion can not be checked',
                'description': 'Arbiter confirm assertion text contains statement that may not be checked for true or false due to some "Force Majeure"',
                'sorting_order': 112,
            },
            'withdraw': {
                'title': 'Withdraw ether',
                'description': 'Contract owner, his opponent and arbiter call withdraw after disput has ended in some way to take out ether',
                'sorting_order': 113,
            },
            'deleteContract': {
                'title': 'Drop contract',
                'description': 'Owner may drop contract on some stages (for example if there is no opponnet has been found to bet)',
                'sorting_order': 114,
            },
        }

        return {
            "result": "success",
            'function_specs': function_titles,
            'dashboard_functions': ['IsArbiterAddressConfirmed', 'IsOpponentBetConfirmed',]
        }


    # language=Solidity
    _TEMPLATE = """
pragma solidity ^0.4.20;

library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
    if (a == 0) {
      return 0;
    }

    c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return a / b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    assert(c >= a);
    return c;
  }
}

contract BetMe {
	using SafeMath for uint256;

	string public Assertion;
	uint256 public Deadline;
	uint256 public ArbiterFee;
	uint256 public ArbiterPenaltyAmount;

	uint256 public StateVersion;
	uint256 private betAmount;

	address public OwnerAddress;
	address public ArbiterAddress;
	address public OpponentAddress;

	bool public IsArbiterAddressConfirmed;
	bool public IsOpponentBetConfirmed;
	bool public ArbiterHasVoted;
	bool public IsDecisionMade;
	bool public IsAssertionTrue;
	bool public IsOwnerTransferMade;
	bool public IsArbiterTransferMade;
	bool public IsOpponentTransferMade;

	function BetMe(
		string  _assertion,
		uint256 _deadline,
		uint256 _fee,
		address _arbiterAddr,
		address _opponentAddr,
		uint256 _arbiterPenaltyAmount
	) public {
		OwnerAddress = msg.sender;
		_setAssertionText(_assertion);
		_setDeadline(_deadline);
		_setArbiterFee(_fee);
		ArbiterAddress  = _arbiterAddr;
		OpponentAddress = _opponentAddr;
		ArbiterPenaltyAmount = _arbiterPenaltyAmount;
	}

	modifier onlyOwner() {
		require(msg.sender == OwnerAddress);
		_;
	}

	modifier forbidOwner() {
		require(msg.sender != OwnerAddress);
		_;
	}

	modifier onlyArbiter() {
		require(msg.sender == ArbiterAddress);
		_;
	}

	modifier forbidArbiter() {
		require(msg.sender != ArbiterAddress);
		_;
	}

	modifier ensureTimeToVote() {
		require(IsVotingInProgress());
		_;
	}

	modifier onlyArbiterCandidate() {
		require(!IsArbiterAddressConfirmed);
		require(msg.sender == ArbiterAddress);
		_;
	}

	modifier increaseState() {
		StateVersion = StateVersion.add(1);
		_;
	}

	modifier whileBetNotMade() {
		require(betAmount == 0);
		_;
	}

	modifier requireOwnerBetIsMade() {
		require(betAmount != 0);
		_;
	}

	modifier requireArbiterNotConfirmed() {
		require(!IsArbiterAddressConfirmed);
		_;
	}

	modifier stateNumberMatches(uint256 _agreedState) {
		require(StateVersion == _agreedState);
		_;
	}

	modifier requireArbiterConfirmed() {
		require(IsArbiterAddressConfirmed);
		_;
	}

	modifier requireOpponentBetIsNotMade() {
		require(!IsOpponentBetConfirmed);
		_;
	}

	function IsVotingInProgress() internal view returns (bool) {
		return IsArbiterAddressConfirmed && IsOpponentBetConfirmed && !ArbiterHasVoted && getTime() < Deadline;
	}

	function IsArbiterLazy() internal view returns (bool) {
		return (IsOpponentBetConfirmed && getTime() > Deadline && !ArbiterHasVoted);
	}

	function getTime() public view returns (uint256) {
		return now;
	}

	function setAssertionText(string _text) public onlyOwner increaseState whileBetNotMade {
		_setAssertionText(_text);
	}

	function _setAssertionText(string _text) internal {
		require(bytes(_text).length > 0);
		Assertion = _text;
	}

	function setDeadline(uint256 _timestamp) public onlyOwner increaseState requireArbiterNotConfirmed {
		_setDeadline(_timestamp);
	}

	function _setDeadline(uint256 _timestamp) internal {
		require(_timestamp > getTime());
		Deadline = _timestamp;
	}

	function setArbiterFee(uint256 _percent) public onlyOwner requireArbiterNotConfirmed increaseState {
		_setArbiterFee(_percent);
	}

	function _setArbiterFee(uint256 _percent) internal {
		require(_percent < 100e18); // 100.0% float as integer with decimal=18
		ArbiterFee      = _percent;
	}

	function setOpponentAddress(address _addr) public 
		onlyOwner 
		increaseState
		requireOpponentBetIsNotMade
	{
		require(_addr != address(OpponentAddress));
		require(_addr != address(OwnerAddress));
		require(_addr != address(ArbiterAddress) || _addr == address(0));
		OpponentAddress = _addr;
	}

	function setArbiterAddress(address _addr) public onlyOwner requireArbiterNotConfirmed increaseState {
		require(_addr != address(ArbiterAddress));
		require(_addr != address(OwnerAddress));
		require(_addr != address(OpponentAddress) || _addr == address(0));
		ArbiterAddress = _addr;
	}

	function bet() public payable onlyOwner whileBetNotMade {
		require(msg.value > 0);
		betAmount = msg.value;
	}

	function currentBet() public view returns (uint256) {
		return betAmount;
	}

	function setArbiterPenaltyAmount(uint256 _amount) public onlyOwner requireArbiterNotConfirmed increaseState {
		require(_amount != ArbiterPenaltyAmount);
		ArbiterPenaltyAmount = _amount;
	}

	function agreeToBecameArbiter(uint256 _agreedState) public payable 
		onlyArbiterCandidate
		requireOwnerBetIsMade 
		stateNumberMatches(_agreedState)
	{
		require(ArbiterAddress != address(0));
		require(msg.value == ArbiterPenaltyAmount);
		IsArbiterAddressConfirmed = true;
	}

	function arbiterSelfRetreat() public onlyArbiter requireArbiterConfirmed requireOpponentBetIsNotMade {
		IsArbiterAddressConfirmed = false;
		if (ArbiterPenaltyAmount > 0 ) {
			ArbiterAddress.transfer(ArbiterPenaltyAmount);
		}
	}

	function betAssertIsFalse(uint256 _agreedState) public payable 
		requireOwnerBetIsMade 
		forbidOwner
		requireArbiterConfirmed
		forbidArbiter
		stateNumberMatches(_agreedState) 
		requireOpponentBetIsNotMade
	{
		require(msg.value == betAmount);
		if (OpponentAddress == address(0)) {
			OpponentAddress = msg.sender;
		} else {
			require(OpponentAddress == msg.sender);
		}
		IsOpponentBetConfirmed = true;
	}

	function agreeAssertionTrue() public onlyArbiter ensureTimeToVote {
		ArbiterHasVoted = true;
		IsDecisionMade = true;
		IsAssertionTrue = true;
	}

	function agreeAssertionFalse() public onlyArbiter ensureTimeToVote {
		ArbiterHasVoted = true;
		IsDecisionMade = true;
	}

	function agreeAssertionUnresolvable() public onlyArbiter ensureTimeToVote {
		ArbiterHasVoted = true;
	}

	function withdraw() public {
		require(ArbiterHasVoted || getTime() > Deadline);
		if (msg.sender == ArbiterAddress) {
			withdrawArbiter();
		} else if (msg.sender == OwnerAddress) {
			withdrawOwner();
		} else if (msg.sender == OpponentAddress) {
			withdrawOpponent();
		} else {
			revert();
		}
	}

	function withdrawArbiter() internal {
		require(!IsArbiterTransferMade);
		IsArbiterTransferMade = true;
		if (IsArbiterLazy()) return;
		uint256 amount = IsArbiterAddressConfirmed ? ArbiterPenaltyAmount : 0;
		if (ArbiterHasVoted && IsDecisionMade) {
			amount = amount.add(ArbiterFeeAmountInEther());
		}
		if (amount > 0) ArbiterAddress.transfer(amount);
	}

	function withdrawOwner() internal {
		require(!IsDecisionMade || IsAssertionTrue);
		require(!IsOwnerTransferMade);
		IsOwnerTransferMade = true;
		OwnerAddress.transfer(ownerPayout());
	}

	function withdrawOpponent() internal {
		require(IsOpponentTransferPending());
		IsOpponentTransferMade = true;
		OpponentAddress.transfer(opponentPayout());
	}

	function ArbiterFeeAmountInEther() public view returns (uint256){
		return betAmount.mul(ArbiterFee).div(1e20);
	}
	
	function WinnerPayout() internal view returns (uint256) {
		return betAmount.mul(2).sub(ArbiterFeeAmountInEther());
	}

	function ownerPayout() public view returns (uint256) {
		if ( getTime() > Deadline && !ArbiterHasVoted && IsOpponentBetConfirmed) {
			return betAmount.add(ArbiterPenaltyAmount.div(2));
		}
		if (ArbiterHasVoted && IsDecisionMade) {
			return (IsAssertionTrue ? WinnerPayout() : 0);
		} else {
			return betAmount;
		}
	}

	function opponentPayout() public view returns (uint256) {
		if (getTime() > Deadline && !ArbiterHasVoted) {
			return betAmount.add(ArbiterPenaltyAmount.div(2));
		}
		if (ArbiterHasVoted && IsDecisionMade) {
			return (IsAssertionTrue ? 0 : WinnerPayout());
		}
		return IsOpponentBetConfirmed ? betAmount : 0;
	}

	function arbiterPayout() public view returns (uint256 amount) {
		if (IsArbiterLazy()) return 0;
		if (!ArbiterHasVoted || IsDecisionMade) {
			amount = ArbiterFeeAmountInEther();
		}
		if (IsArbiterAddressConfirmed) {
			amount = amount.add(ArbiterPenaltyAmount);
		}
	}

	function IsOpponentTransferPending() internal view returns (bool) {
		if (IsOpponentTransferMade) return false;
		if (IsArbiterLazy()) return true;
		if (ArbiterHasVoted && !IsAssertionTrue) return true;
		return false;
	}

	function deleteContract() public onlyOwner {
		require(!IsVotingInProgress());
		require(!IsOpponentTransferPending());
		if (IsArbiterAddressConfirmed && !IsArbiterTransferMade) {
			withdrawArbiter();
		}
		selfdestruct(OwnerAddress);
	}
}

contract BetMeWrapper is BetMe("%assertion%", %deadline%, %feePercent%, %arbiterAddr%, %opponentAddr%, %arbiterPenaltyAmount%){}

%payment_code%
    """
