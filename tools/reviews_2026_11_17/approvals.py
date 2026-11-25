"""Anish's calls on the new draft lines of the 17 Nov 2026 pass, taken from his comments on the reading list.
APPROVED: line id -> his words. An approved line stays on the card exactly as shown and its status becomes 'approved'.
REWORDED: line id -> (new text, his words). The line is approved in the new wording.
DROPPED: line id -> his words. The line is taken off the card and kept in the data as 'held'."""
APPROVED = {
    'ctb26-pro-6': 'yes',
    'ctb26-con-7': 'yes',
    'cpp2-con-5': 'yes',
    'tp4-pro-4': 'yes',
    'tp4-pro-5': 'yes',
    'tp4-pro-6': 'yes',
    'tp4-con-5': 'yes',
    'tp4-con-6': 'yes',
    'tp4-con-7': 'yes',
    'cicada-pro-7': 'yes',
    'cicada-pro-8': 'yes',
    'cicada-con-5': 'ok',
    'dfly-con-4': 'ok',
    'ct15l-pro-6': 'ok to both',
    'ct15l-pro-7': 'ok to both',
    'ct15p-pro-6': 'ok for all',
    'ct15p-pro-7': 'ok for all',
    'ct15p-pro-8': 'ok for all',
    'ct15p-con-4': 'ok for all',
    'ct21l-pro-5': 'ok (on the CT21 Lite heading)',
    'ct21l-pro-6': 'ok (on the CT21 Lite heading)',
    'ct21p-pro-4': 'ok (on the CT21 Plus heading)',
    'ct21p-pro-5': 'ok (on the CT21 Plus heading)',
    'ct21p-pro-6': 'ok (on the CT21 Plus heading)',
    'ct21p-pro-7': 'ok (on the CT21 Plus heading)',
    'ct21p-pro-8': 'ok (on the CT21 Plus heading)',
    'ct21p-con-3': 'ok (on the CT21 Plus heading)',
    'edx-pro-5': 'yes (on the EDX heading)',
    'edx-pro-6': 'yes (on the EDX heading)',
    'slite-pro-6': 'agree to all (on the Superlite heading)',
    'slite-pro-7': 'agree to all (on the Superlite heading)',
    'slite-con-5': 'agree to all (on the Superlite heading)',
    'slite-con-6': 'agree to all (on the Superlite heading)',
    'wlh30-pro-5': 'agree (on the Hugger heading)',
    'wlh30-pro-6': 'agree (on the Hugger heading)',
}
REWORDED = {
    # T3 says the false bottom 'protects your tech nicely'; Aidil Azeman only shows that the sleeve stops short of the base
    'cpp2-pro-5': ("Good laptop protection: a false bottom keeps the laptop off the base.", 'Yes - see if you can include good  laptop protection'),
}
DROPPED = {
    'cicada-pro-9': 'yes, but not worth highlighting as a feature',
    'cicada-con-6': 'Can ignore since we have also include the EWP version here',
    'slite-note-1': 'valid for all bags in this list, so not something to highlight here',
    'cpp2-con-6': 'Drop, since the tightness of the pocket is mentioned already.',
    'slite-con-7': 'drop it for now (his thought: features such as the second bottle pocket and harness adjustment were dropped to save weight, but he has no definite source for that)',
}

# "Maker says" lines added at Anish's word. Key: bag key of this pass; value: feature entries as they go into the bag file.
# cpp2: he asked for the movable key leash to be noted ('Maybe you can mention that the keyleash is movable to several parts of
# the bag as a good point to note'). Aer's page says only "Removable, repositionable keychain", so the line stays with that.
ADD_FEATURES = {
    'cpp2': [dict(id='cpp2-feat-1', text='Removable keychain that can be repositioned.', scope='design',
                  sources=['aer-city-pack-pro-2-ultra-24l'], applies_to=['city-pack-pro-2-ultra-24l'], status='approved')],
}
