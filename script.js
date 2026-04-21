const API_BASE_URL = "https://petstore.swagger.io/v2/pet";

const state = {
  pets: [],
  currentFilter: "all",
  searchQuery: "",
  selectedPet: null
};

const elements = {
  petGrid: document.getElementById("petGrid"),
  petForm: document.getElementById("petForm"),
  filterForm: document.getElementById("filterForm"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  nameInput: document.getElementById("nameInput"),
  statusInput: document.getElementById("statusInput"),
  photoInput: document.getElementById("photoInput"),
  categoryInput: document.getElementById("categoryInput"),
  addButton: document.getElementById("addButton"),
  refreshButton: document.getElementById("refreshButton"),
  saveButton: document.getElementById("saveButton"),
  deleteButton: document.getElementById("deleteButton"),
  resultsMeta: document.getElementById("resultsMeta"),
  emptyState: document.getElementById("emptyState"),
  loaderOverlay: document.getElementById("loaderOverlay"),
  toastStack: document.getElementById("toastStack"),
  formModeLabel: document.getElementById("formModeLabel")
};

function setLoading(isLoading) {
  elements.loaderOverlay.classList.toggle("is-hidden", !isLoading);
  elements.loaderOverlay.setAttribute("aria-hidden", String(!isLoading));
  elements.saveButton.disabled = isLoading;
  elements.refreshButton.disabled = isLoading;
  elements.addButton.disabled = isLoading;
  elements.deleteButton.disabled = isLoading;
}

function showToast(type, title, message) {
  const toast = document.createElement("article");
  toast.className = "toast toast-" + type;
  toast.innerHTML =
    '<p class="toast-title">' + escapeHtml(title) + "</p>" +
    '<p class="toast-message">' + escapeHtml(message) + "</p>";

  elements.toastStack.appendChild(toast);

  window.setTimeout(function () {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";

    window.setTimeout(function () {
      toast.remove();
    }, 200);
  }, 3000);
}

function escapeHtml(value) {
  let text = String(value == null ? "" : value);
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace(/"/g, "&quot;");
  text = text.replace(/'/g, "&#39;");
  return text;
}

function escapeAttribute(value) {
  let text = escapeHtml(value);
  text = text.replace(/`/g, "&#96;");
  return text;
}

function getStatusLabel(status) {
  if (status === "available") {
    return "Available";
  }

  if (status === "pending") {
    return "Pending";
  }

  if (status === "sold") {
    return "Sold";
  }

  return "Unknown";
}

function getStatusClass(status) {
  if (status === "available") {
    return "available";
  }

  if (status === "pending") {
    return "pending";
  }

  return "sold";
}

function normalizePet(pet) {
  let photoUrls = [];
  let firstPhoto = "";
  let categoryId = null;
  let categoryName = "";
  let tags = [];
  let i = 0;

  if (Array.isArray(pet.photoUrls)) {
    photoUrls = pet.photoUrls;
  }

  for (i = 0; i < photoUrls.length; i += 1) {
    if (typeof photoUrls[i] === "string" && photoUrls[i].trim() !== "") {
      firstPhoto = photoUrls[i];
      break;
    }
  }

  if (pet.category) {
    if (!isNaN(Number(pet.category.id))) {
      categoryId = Number(pet.category.id);
    }

    if (typeof pet.category.name === "string" && pet.category.name.trim() !== "") {
      categoryName = pet.category.name.trim();
    }
  }

  if (Array.isArray(pet.tags)) {
    tags = pet.tags;
  }

  return {
    id: Number(pet.id),
    name: typeof pet.name === "string" && pet.name.trim() !== "" ? pet.name.trim() : "Untitled pet",
    status: typeof pet.status === "string" && pet.status.trim() !== "" ? pet.status.trim().toLowerCase() : "available",
    photoUrls: photoUrls,
    image: firstPhoto,
    categoryId: categoryId,
    category: categoryName,
    tags: tags
  };
}

async function request(path, options) {
  let finalPath = "";
  let finalOptions = {};
  let response;
  let message = "Request failed.";
  let errorBody;
  let text;

  if (!path) {
    finalPath = "";
  } else {
    finalPath = path;
  }

  finalOptions.headers = {
    "Content-Type": "application/json"
  };

  if (options) {
    if (options.method) {
      finalOptions.method = options.method;
    }

    if (options.body) {
      finalOptions.body = options.body;
    }
  }

  response = await fetch(API_BASE_URL + finalPath, finalOptions);

  if (!response.ok) {
    try {
      errorBody = await response.json();

      if (errorBody.message) {
        message = errorBody.message;
      } else if (errorBody.error) {
        message = errorBody.error;
      }
    } catch (error) {
      if (response.statusText) {
        message = response.statusText;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

const api = {
  getPetsByStatus: async function (status) {
    const statusQuery = encodeURIComponent(status);
    const pets = await request("/findByStatus?status=" + statusQuery);
    let result = [];
    let i = 0;

    if (!Array.isArray(pets)) {
      return result;
    }

    for (i = 0; i < pets.length; i += 1) {
      result.push(normalizePet(pets[i]));
    }

    return result;
  },

  getAllPets: async function () {
    const available = await this.getPetsByStatus("available");
    const pending = await this.getPetsByStatus("pending");
    const sold = await this.getPetsByStatus("sold");
    const allPets = [];
    let i = 0;

    for (i = 0; i < available.length; i += 1) {
      allPets.push(available[i]);
    }

    for (i = 0; i < pending.length; i += 1) {
      allPets.push(pending[i]);
    }

    for (i = 0; i < sold.length; i += 1) {
      allPets.push(sold[i]);
    }

    return dedupePets(allPets);
  },

  createPet: async function (payload) {
    const createdPet = await request("", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (createdPet) {
      return normalizePet(createdPet);
    }

    return normalizePet(payload);
  },

  updatePet: async function (payload) {
    const updatedPet = await request("", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    if (updatedPet) {
      return normalizePet(updatedPet);
    }

    return normalizePet(payload);
  },

  deletePet: async function (petId) {
    return request("/" + petId, {
      method: "DELETE"
    });
  }
};

function dedupePets(pets) {
  const usedIds = {};
  const uniquePets = [];
  let i = 0;
  let pet;
  let id;

  for (i = 0; i < pets.length; i += 1) {
    pet = normalizePet(pets[i]);
    id = Number(pet.id);
    usedIds[id] = pet;
  }

  for (id in usedIds) {
    if (Object.prototype.hasOwnProperty.call(usedIds, id)) {
      uniquePets.push(usedIds[id]);
    }
  }

  uniquePets.sort(function (a, b) {
    return b.id - a.id;
  });

  return uniquePets;
}

function getVisiblePets() {
  const query = state.searchQuery.trim().toLowerCase();
  const pets = [];
  const result = [];
  let i = 0;
  let pet;

  for (i = 0; i < state.pets.length; i += 1) {
    pet = state.pets[i];

    if (state.currentFilter === "all" || pet.status === state.currentFilter) {
      pets.push(pet);
    }
  }

  pets.sort(function (a, b) {
    return b.id - a.id;
  });

  if (query === "") {
    return pets;
  }

  for (i = 0; i < pets.length; i += 1) {
    if (pets[i].name.toLowerCase().indexOf(query) !== -1) {
      result.push(pets[i]);
    }
  }

  return result;
}

function syncResultsMeta(visiblePets) {
  const total = state.pets.length;
  const filtered = visiblePets.length;
  let filterLabel = "";

  if (state.currentFilter === "all") {
    filterLabel = "всех статусов";
  } else {
    filterLabel = getStatusLabel(state.currentFilter);
  }

  if (state.searchQuery.trim() !== "") {
    elements.resultsMeta.textContent = "Найдено: " + filtered + ". Загружено: " + total + ". Фильтр: " + filterLabel + ".";
    return;
  }

  elements.resultsMeta.textContent = "Загружено питомцев: " + total + ". Фильтр: " + filterLabel + ".";
}

function createPetCardHtml(pet) {
  let imageHtml = "";

  if (pet.image) {
    imageHtml = '<img src="' + escapeAttribute(pet.image) + '" alt="' + escapeAttribute(pet.name) + '" loading="lazy" />';
  } else {
    imageHtml = '<div class="pet-image-placeholder">Нет картинки</div>';
  }

  return '' +
    '<article class="pet-card" data-pet-id="' + pet.id + '">' +
      '<div class="pet-image">' +
        imageHtml +
      "</div>" +
      '<div class="pet-meta">' +
        '<div class="pet-meta-top">' +
          "<div>" +
            '<h3 class="pet-name">' + escapeHtml(pet.name) + "</h3>" +
            '<p class="pet-id">ID ' + escapeHtml(pet.id) + "</p>" +
          "</div>" +
          '<span class="badge badge-' + getStatusClass(pet.status) + '">' + escapeHtml(getStatusLabel(pet.status)) + "</span>" +
        "</div>" +
        '<div class="pet-footer">' +
          '<p class="pet-category">' + escapeHtml(pet.category || "Uncategorized") + "</p>" +
          '<button class="icon-button edit-button" type="button" aria-label="Edit ' + escapeAttribute(pet.name) + '">✏️</button>' +
        "</div>" +
      "</div>" +
    "</article>";
}

function addImageFallbacks() {
  const images = elements.petGrid.querySelectorAll("img");
  let i = 0;

  for (i = 0; i < images.length; i += 1) {
    images[i].addEventListener("error", handleImageError, { once: true });
  }
}

function handleImageError(event) {
  const image = event.target;
  const imageWrap = image.closest(".pet-image");

  if (imageWrap) {
    imageWrap.innerHTML = '<div class="pet-image-placeholder">Нет картинки</div>';
  }
}

function renderPets() {
  const visiblePets = getVisiblePets();
  let html = "";
  let i = 0;

  syncResultsMeta(visiblePets);

  elements.emptyState.classList.toggle("is-hidden", visiblePets.length > 0);
  elements.petGrid.classList.toggle("is-hidden", visiblePets.length === 0);

  if (visiblePets.length === 0) {
    elements.petGrid.innerHTML = "";
    return;
  }

  for (i = 0; i < visiblePets.length; i += 1) {
    html += createPetCardHtml(visiblePets[i]);
  }

  elements.petGrid.innerHTML = html;
  addImageFallbacks();
}

function renderForm() {
  const pet = state.selectedPet;

  if (!pet) {
    elements.petForm.reset();
    elements.statusInput.value = "available";
    elements.deleteButton.classList.add("is-hidden");
    elements.formModeLabel.textContent = "Добавление / редактирование питомца.";
    elements.saveButton.textContent = "Сохранить";
    return;
  }

  elements.nameInput.value = pet.name;
  elements.statusInput.value = pet.status;
  elements.photoInput.value = pet.photoUrls[0] || "";
  elements.categoryInput.value = pet.category;
  elements.deleteButton.classList.remove("is-hidden");
  elements.formModeLabel.textContent = "Редактирование питомца #" + pet.id + ".";
  elements.saveButton.textContent = "Сохранить";
}

function render() {
  renderForm();
  renderPets();
}

function resetForm() {
  state.selectedPet = null;
  renderForm();
}

function buildPetPayload() {
  const name = elements.nameInput.value.trim();
  const status = elements.statusInput.value;
  const photoUrl = elements.photoInput.value.trim();
  const categoryName = elements.categoryInput.value.trim();
  const existingPet = state.selectedPet;
  let petId = Date.now();
  let categoryObject;
  let tags = [];

  if (existingPet && existingPet.id) {
    petId = existingPet.id;
  }

  if (existingPet && Array.isArray(existingPet.tags)) {
    tags = existingPet.tags;
  }

  if (categoryName !== "") {
    if (existingPet && existingPet.categoryId) {
      categoryObject = {
        id: existingPet.categoryId,
        name: categoryName
      };
    } else {
      categoryObject = {
        id: Date.now(),
        name: categoryName
      };
    }
  }

  return {
    id: petId,
    name: name,
    status: status,
    photoUrls: photoUrl !== "" ? [photoUrl] : [],
    category: categoryObject,
    tags: tags
  };
}

function validateForm() {
  const name = elements.nameInput.value.trim();

  if (name === "") {
    showToast("warning", "Нужно имя", "Перед сохранением укажите имя питомца.");
    elements.nameInput.focus();
    return false;
  }

  if (name.length > 50) {
    showToast("warning", "Слишком длинное имя", "Имя питомца должно быть не длиннее 50 символов.");
    elements.nameInput.focus();
    return false;
  }

  if (elements.photoInput.value.trim() !== "" && !elements.photoInput.checkValidity()) {
    showToast("warning", "Некорректный URL", "Укажите корректную ссылку на фото или оставьте поле пустым.");
    elements.photoInput.focus();
    return false;
  }

  return true;
}

function upsertPetInState(pet) {
  const normalizedPet = normalizePet(pet);
  let foundIndex = -1;
  let i = 0;

  for (i = 0; i < state.pets.length; i += 1) {
    if (state.pets[i].id === normalizedPet.id) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex >= 0) {
    state.pets[foundIndex] = normalizedPet;
  } else {
    state.pets.unshift(normalizedPet);
  }

  state.selectedPet = normalizedPet;
}

function removePetFromState(petId) {
  const newPets = [];
  let i = 0;

  for (i = 0; i < state.pets.length; i += 1) {
    if (state.pets[i].id !== petId) {
      newPets.push(state.pets[i]);
    }
  }

  state.pets = newPets;

  if (state.selectedPet && state.selectedPet.id === petId) {
    state.selectedPet = null;
  }
}

async function loadPets(filter) {
  let selectedFilter = filter;

  if (!selectedFilter) {
    selectedFilter = state.currentFilter;
  }

  state.currentFilter = selectedFilter;
  setLoading(true);

  try {
    if (selectedFilter === "all") {
      state.pets = await api.getAllPets();
    } else {
      state.pets = await api.getPetsByStatus(selectedFilter);
    }

    renderPets();
  } catch (error) {
    state.pets = [];
    renderPets();
    showToast("error", "Не удалось загрузить", error.message || "Попробуйте ещё раз.");
  } finally {
    setLoading(false);
  }
}

async function handleSave(event) {
  let isEditing;
  let payload;
  let savedPet;

  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  isEditing = Boolean(state.selectedPet);
  payload = buildPetPayload();

  setLoading(true);

  try {
    if (isEditing) {
      savedPet = await api.updatePet(payload);
    } else {
      savedPet = await api.createPet(payload);
    }

    upsertPetInState(savedPet);
    render();

    if (isEditing) {
      showToast("success", "Питомец обновлён", savedPet.name + ": статус " + getStatusLabel(savedPet.status) + ".");
    } else {
      showToast("success", "Питомец создан", savedPet.name + ": статус " + getStatusLabel(savedPet.status) + ".");
    }
  } catch (error) {
    showToast("error", "Ошибка сохранения", error.message || "Попробуйте ещё раз.");
  } finally {
    setLoading(false);
  }
}

async function handleDelete() {
  const pet = state.selectedPet;
  let confirmed;

  if (!pet) {
    return;
  }

  confirmed = window.confirm("Удалить " + pet.name + "?");

  if (!confirmed) {
    return;
  }

  setLoading(true);

  try {
    await api.deletePet(pet.id);
    removePetFromState(pet.id);
    render();
    showToast("success", "Питомец удалён", pet.name + " удалён из текущего списка.");
  } catch (error) {
    removePetFromState(pet.id);
    render();
    showToast("warning", "Удалено локально", error.message || "Удаление не сохранилось на API, но запись убрана из текущей сессии.");
  } finally {
    resetForm();
    render();
    setLoading(false);
  }
}

function handleFilterChange(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.name !== "statusFilter") {
    return;
  }

  state.searchQuery = "";
  elements.searchInput.value = "";
  resetForm();
  loadPets(target.value);
}

function handleSearchSubmit(event) {
  event.preventDefault();
  state.searchQuery = elements.searchInput.value.trim();
  renderPets();
}

function handleSearchInput(event) {
  state.searchQuery = event.target.value.trim();
  renderPets();
}

function handleEditButtonClick(event) {
  const editButton = event.target.closest(".edit-button");
  const card = editButton ? editButton.closest(".pet-card") : null;
  const petId = card ? Number(card.dataset.petId) : NaN;
  let pet = null;
  let i = 0;

  if (!editButton) {
    return;
  }

  for (i = 0; i < state.pets.length; i += 1) {
    if (state.pets[i].id === petId) {
      pet = state.pets[i];
      break;
    }
  }

  if (!pet) {
    showToast("warning", "Питомец не найден", "Обновите список и попробуйте снова.");
    return;
  }

  state.selectedPet = {
    id: pet.id,
    name: pet.name,
    status: pet.status,
    photoUrls: pet.photoUrls,
    image: pet.image,
    categoryId: pet.categoryId,
    category: pet.category,
    tags: pet.tags
  };

  renderForm();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleAddClick() {
  resetForm();
  showToast("success", "Форма очищена", "Можно добавлять нового питомца.");
}

function handleRefreshClick() {
  state.searchQuery = "";
  elements.searchInput.value = "";
  resetForm();
  loadPets(state.currentFilter);
  showToast("success", "Список обновлён", "Данные снова загружены из Swagger Petstore.");
}

function attachEventListeners() {
  elements.petForm.addEventListener("submit", handleSave);
  elements.deleteButton.addEventListener("click", handleDelete);
  elements.filterForm.addEventListener("change", handleFilterChange);
  elements.searchForm.addEventListener("submit", handleSearchSubmit);
  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.petGrid.addEventListener("click", handleEditButtonClick);
  elements.addButton.addEventListener("click", handleAddClick);
  elements.refreshButton.addEventListener("click", handleRefreshClick);
}

function init() {
  attachEventListeners();
  render();
  loadPets(state.currentFilter);
}

document.addEventListener("DOMContentLoaded", init);
