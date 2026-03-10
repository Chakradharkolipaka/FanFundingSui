module fan_funding::nft_donation {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::package;
    use sui::display;

    // ─── Error codes ────────────────────────────────────────
    const E_NOT_OWNER: u64 = 1;
    const E_TOKEN_NOT_FOUND: u64 = 2;
    const E_ZERO_DONATION: u64 = 3;
    const E_ALREADY_INITIALIZED: u64 = 4;

    // ─── One-Time Witness for Display ───────────────────────
    public struct NFT_DONATION has drop {}

    // ─── Structs ────────────────────────────────────────────

    /// Shared object that holds the collection state.
    /// Similar to Aptos Collection resource but lives as a shared object.
    public struct Collection has key {
        id: UID,
        owner: address,
        next_id: u64,
        /// Mapping token_id -> creator address for tracking
        token_creators: Table<u64, address>,
    }

    /// Each NFT is a shared object so anyone can donate to it.
    /// Equivalent to the NFTToken struct in the Aptos contract.
    public struct FanToken has key, store {
        id: UID,
        token_id: u64,
        creator: address,
        name: String,
        description: String,
        token_uri: String,
        total_funded: u64,
    }

    // ─── Events ─────────────────────────────────────────────

    public struct MintEvent has copy, drop {
        token_id: u64,
        creator: address,
        name: String,
        token_uri: String,
    }

    public struct DonationEvent has copy, drop {
        token_id: u64,
        donor: address,
        amount: u64,
        creator: address,
    }

    // ─── Init (called once on publish) ──────────────────────

    fun init(otw: NFT_DONATION, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"creator"),
        ];
        let values = vector[
            string::utf8(b"{name}"),
            string::utf8(b"{description}"),
            string::utf8(b"{token_uri}"),
            string::utf8(b"{creator}"),
        ];

        let mut display = display::new_with_fields<FanToken>(
            &publisher, keys, values, ctx,
        );
        display::update_version(&mut display);

        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }

    // ─── Admin: Initialize Collection ───────────────────────

    /// Creates a shared Collection object. Must be called once after publish.
    /// Equivalent to init_collection in the Aptos contract.
    public entry fun init_collection(ctx: &mut TxContext) {
        let collection = Collection {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            next_id: 1,
            token_creators: table::new(ctx),
        };
        transfer::share_object(collection);
    }

    // ─── Mint NFT ───────────────────────────────────────────

    /// Mint a new FanToken NFT. Anyone can call this.
    /// The NFT is shared so that anyone can donate to it.
    public entry fun mint_nft(
        collection: &mut Collection,
        name: vector<u8>,
        description: vector<u8>,
        token_uri: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let token_id = collection.next_id;
        collection.next_id = token_id + 1;

        let creator = tx_context::sender(ctx);

        // Track creator in collection
        table::add(&mut collection.token_creators, token_id, creator);

        let token = FanToken {
            id: object::new(ctx),
            token_id,
            creator,
            name: string::utf8(name),
            description: string::utf8(description),
            token_uri: string::utf8(token_uri),
            total_funded: 0,
        };

        event::emit(MintEvent {
            token_id,
            creator,
            name: string::utf8(name),
            token_uri: string::utf8(token_uri),
        });

        // Share the token so anyone can reference it for donations
        transfer::share_object(token);
    }

    // ─── Donate ─────────────────────────────────────────────

    /// Donate SUI to the creator of an NFT.
    /// The FanToken must be a shared object (which it is after mint).
    public entry fun donate(
        token: &mut FanToken,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&payment);
        assert!(amount > 0, E_ZERO_DONATION);

        // Transfer SUI to the creator
        transfer::public_transfer(payment, token.creator);

        // Update total funded
        token.total_funded = token.total_funded + amount;

        event::emit(DonationEvent {
            token_id: token.token_id,
            donor: tx_context::sender(ctx),
            amount,
            creator: token.creator,
        });
    }

    // ─── View helpers ───────────────────────────────────────

    /// Returns the total number of minted NFTs.
    public fun total_supply(collection: &Collection): u64 {
        collection.next_id - 1
    }

    /// Returns the token_id of a FanToken.
    public fun get_token_id(token: &FanToken): u64 {
        token.token_id
    }

    /// Returns the creator of a FanToken.
    public fun get_creator(token: &FanToken): address {
        token.creator
    }

    /// Returns the total funded amount of a FanToken.
    public fun get_total_funded(token: &FanToken): u64 {
        token.total_funded
    }

    /// Returns the token URI of a FanToken.
    public fun get_token_uri(token: &FanToken): String {
        token.token_uri
    }
}
