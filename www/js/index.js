document.addEventListener('deviceready', function () {


$(document).ready(function () {
    let contacts = [];
    let currentContactId = null;

    function init() {
        bindEvents();
        requestPermissionsAndLoadContacts();
    }

    function requestPermissionsAndLoadContacts() {
        if (window.cordova && cordova.plugins && cordova.plugins.permissions) {
            const permissions = cordova.plugins.permissions;
            permissions.requestPermissions(
                [permissions.READ_CONTACTS, permissions.WRITE_CONTACTS],
                function (status) {
                    if (status.hasPermission) {
                        loadDeviceContacts();
                    } else {
                        showToast("Permission contacts refusée");
                    }
                },
                function () {
                    showToast("Erreur lors de la demande de permission");
                }
            );
        } else {
            loadDeviceContacts(); 
        }
    }

    function loadDeviceContacts() {
        const options = new ContactFindOptions();
        options.filter = "";
        options.multiple = true;
        options.desiredFields = [navigator.contacts.fieldType.displayName, navigator.contacts.fieldType.name, navigator.contacts.fieldType.phoneNumbers];

        const fields = [navigator.contacts.fieldType.displayName, navigator.contacts.fieldType.name, navigator.contacts.fieldType.phoneNumbers];

        navigator.contacts.find(fields, function (deviceContacts) {
            contacts = deviceContacts
                .filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
                .map(c => ({
                    id: generateId(),
                    nom: c.name.familyName || '',
                    prenom: c.name.givenName || '',
                    telephone: c.phoneNumbers[0].value,
                    email: '',
                    poste: '',
                    source: 'device'
                }));

            renderContactList();
            updateContactCount();
            showEmptyStateIfNeeded();
        }, function (error) {
            console.error('Erreur chargement contacts :', error);
            showToast("Erreur lors du chargement des contacts");
        }, options);
    }

    function saveContacts() {
        localStorage.setItem('contacts', JSON.stringify(contacts));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function getInitials(nom, prenom) {
        return (nom.charAt(0) || '').toUpperCase() + (prenom.charAt(0) || '').toUpperCase();
    }

    function getAvatarColor(nom) {
        const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14'];
        let hash = 0;
        for (let i = 0; i < nom.length; i++) {
            hash = nom.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    function renderContactList(filteredContacts = null) {
        const $contactList = $('#contactList');
        $contactList.empty();

        const list = filteredContacts || contacts;
        list.forEach(contact => {
            const initials = getInitials(contact.nom, contact.prenom);
            const avatarColor = getAvatarColor(contact.nom + contact.prenom);

            const $item = $(`
                <li class="contact-item" data-id="${contact.id}">
                    <div class="contact-avatar" style="background-color: ${avatarColor}">${initials}</div>
                    <div class="contact-info">
                        <div class="contact-name">${contact.prenom} ${contact.nom}</div>
                        <div class="contact-phone">${contact.telephone}</div>
                    </div>
                </li>
            `);

            $contactList.append($item);
        });
    }

    function updateContactCount() {
        $('#contactCount').text(`${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`);
    }

    function showEmptyStateIfNeeded() {
        if (contacts.length === 0) {
            $('#emptyState').show();
            $('#contactList').hide();
        } else {
            $('#emptyState').hide();
            $('#contactList').show();
        }
    }

    function showPage(id) {
        $('.page').addClass('hidden');
        $(`#${id}`).removeClass('hidden');
    }

    function showToast(msg) {
        $('#toastMessage').text(msg);
        $('#toast').addClass('show');
        setTimeout(() => $('#toast').removeClass('show'), 3000);
    }

    function validateForm(nom, prenom, tel) {
        if (!nom.trim()) return showToast('Le nom est obligatoire'), false;
        if (!prenom.trim()) return showToast('Le prénom est obligatoire'), false;
        if (!tel.trim()) return showToast('Le téléphone est obligatoire'), false;
        return true;
    }

    function formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10 ? cleaned.replace(/(\d{12})/ ,'$1') : phone;
    }

    function searchContacts(query) {
        if (!query.trim()) return renderContactList();
        const q = query.toLowerCase();
        const filtered = contacts.filter(c =>
            `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            c.telephone.toLowerCase().includes(q)
        );
        renderContactList(filtered);
    }

    function bindEvents() {
        $('#addContactBtn').on('click', () => showPage('addContactPage'));

        $('#backToMainBtn, #cancelAddBtn').on('click', () => {
            showPage('mainPage');
            $('#addContactForm')[0].reset();
        });

        $('#backToListBtn').on('click', () => showPage('mainPage'));
        $('#backToDetailBtn, #cancelEditBtn').on('click', () => {
            showPage('detailContactPage');
            $('#editContactForm')[0].reset();
        });

        $(document).on('click', '.contact-item', function () {
            const id = $(this).data('id');
            showContactDetail(id);
        });

        $('#addContactForm').on('submit', function (e) {
            e.preventDefault();
            const nom = $('#nom').val().trim();
            const prenom = $('#prenom').val().trim();
            const tel = formatPhoneNumber($('#telephone').val().trim());
            const email = $('#email').val().trim();
            const poste = $('#poste').val().trim();

            if (!validateForm(nom, prenom, tel)) return;

            const newContact = {
                id: generateId(),
                nom, prenom,
                telephone: tel,
                email, poste,
                dateCreation: new Date().toISOString()
            };

            contacts.push(newContact);
            saveContacts();
            renderContactList();
            updateContactCount();
            showEmptyStateIfNeeded();

            
            const nativeContact = navigator.contacts.create();
            nativeContact.displayName = `${prenom} ${nom}`;
            nativeContact.name = new ContactName();
            nativeContact.name.givenName = prenom;
            nativeContact.name.familyName = nom;
            nativeContact.phoneNumbers = [new ContactField('mobile', tel, true)];

            nativeContact.save(function () {
                console.log("Contact natif sauvegardé");
            }, function (err) {
                console.error("Erreur contact natif", err);
                showToast("Erreur sauvegarde contact téléphone");
            });

            showToast('Contact ajouté avec succès');
            showPage('mainPage');
            $('#addContactForm')[0].reset();
        });

        $('#editContactBtn').on('click', () => showEditContactPage());

        $('#editContactForm').on('submit', function (e) {
            e.preventDefault();
            const nom = $('#editNom').val().trim();
            const prenom = $('#editPrenom').val().trim();
            const tel = formatPhoneNumber($('#editTelephone').val().trim());
            const email = $('#editEmail').val().trim();
            const poste = $('#editPoste').val().trim();

            if (!validateForm(nom, prenom, tel)) return;

            const index = contacts.findIndex(c => c.id === currentContactId);
            if (index !== -1) {
                contacts[index] = { ...contacts[index], nom, prenom, telephone: tel, email, poste };
                saveContacts();
                renderContactList();
                showContactDetail(currentContactId);
                showToast('Contact modifié avec succès');
            }
        });

        $('#deleteContactBtn').on('click', function () {
            if (confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
                deleteContact(currentContactId);
            }
        });

        $('#searchInput').on('input', function () {
            searchContacts($(this).val());
        });

        $('#telephone, #editTelephone').on('input', function () {
            const val = $(this).val();
            $(this).val(formatPhoneNumber(val));
        });
    }

    function showContactDetail(id) {
        const contact = contacts.find(c => c.id === id);
        if (!contact) return;

        currentContactId = id;
        const initials = getInitials(contact.nom, contact.prenom);
        const color = getAvatarColor(contact.nom + contact.prenom);

        $('#contactPhoto').html(initials).css('background-color', color);
        $('#contactName').text(`${contact.prenom} ${contact.nom}`);
        $('#contactPhone').text(contact.telephone || 'Non renseigné');
        $('#contactEmail').text(contact.email || 'Non renseigné');
        $('#contactJob').text(contact.poste || 'Non renseigné');

        showPage('detailContactPage');
    }

    function showEditContactPage() {
        const contact = contacts.find(c => c.id === currentContactId);
        if (!contact) return;

        $('#editNom').val(contact.nom);
        $('#editPrenom').val(contact.prenom);
        $('#editTelephone').val(contact.telephone);
        $('#editEmail').val(contact.email || '');
        $('#editPoste').val(contact.poste || '');

        showPage('editContactPage');
    }

    function deleteContact(id) {
        const index = contacts.findIndex(c => c.id === id);
        if (index !== -1) {
            contacts.splice(index, 1);
            saveContacts();
            renderContactList();
            updateContactCount();
            showEmptyStateIfNeeded();
            showToast('Contact supprimé avec succès');
            showPage('mainPage');
        }
    }

    // Gérer bouton retour Android
    document.addEventListener('backbutton', function (e) {
        e.preventDefault();
        if (!$('#mainPage').hasClass('hidden')) {
            navigator.app.exitApp();
        } else if (!$('#detailContactPage').hasClass('hidden')) {
            showPage('mainPage');
        } else if (!$('#editContactPage').hasClass('hidden')) {
            showPage('detailContactPage');
        } else if (!$('#addContactPage').hasClass('hidden')) {
            showPage('mainPage');
            $('#addContactForm')[0].reset();
        }
    }, false);

    init();
});
});